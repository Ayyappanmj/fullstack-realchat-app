import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import mongoose from "mongoose";

// In-memory fallback message storage to guarantee 100% demo uptime
const inMemoryMessages = [];

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id?.toString();

    let dbUsers = [];
    const conversationMap = new Map();

    if (mongoose.connection.readyState === 1) {
      try {
        dbUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

        // Exclude demo/test accounts so dummy accounts are not listed
        dbUsers = dbUsers.filter((u) => !u.email?.toLowerCase().endsWith("@demo.com"));

        // Fetch messages involving loggedInUserId to calculate last message & conversation status
        const userObjectId = mongoose.Types.ObjectId.isValid(loggedInUserId)
          ? new mongoose.Types.ObjectId(loggedInUserId)
          : loggedInUserId;

        const recentMessages = await Message.find({
          $or: [
            { senderId: userObjectId },
            { receiverId: userObjectId },
            { senderId: loggedInUserId },
            { receiverId: loggedInUserId },
          ],
        }).sort({ createdAt: -1 });

        for (const m of recentMessages) {
          const partnerId =
            m.senderId?.toString() === loggedInUserId
              ? m.receiverId?.toString()
              : m.senderId?.toString();

          if (!partnerId) continue;

          if (!conversationMap.has(partnerId)) {
            conversationMap.set(partnerId, {
              lastMessage: m.text ? m.text : m.image ? "📷 Photo" : m.audio ? "🎤 Voice message" : "",
              lastMessageTime: m.createdAt,
              unreadCount: m.receiverId?.toString() === loggedInUserId && m.status !== "read" ? 1 : 0,
            });
          } else if (m.receiverId?.toString() === loggedInUserId && m.status !== "read") {
            const existing = conversationMap.get(partnerId);
            existing.unreadCount = (existing.unreadCount || 0) + 1;
          }
        }
      } catch (dbErr) {
        console.warn("DB query failed in getUsersForSidebar, falling back to demo users:", dbErr.message);
      }
    }

    // In-memory messages fallback
    for (const m of inMemoryMessages) {
      const partnerId =
        m.senderId === loggedInUserId ? m.receiverId : m.receiverId === loggedInUserId ? m.senderId : null;
      if (!partnerId) continue;

      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          lastMessage: m.text ? m.text : m.image ? "📷 Photo" : m.audio ? "🎤 Voice message" : "",
          lastMessageTime: m.createdAt,
          unreadCount: m.receiverId === loggedInUserId && m.status !== "read" ? 1 : 0,
        });
      }
    }

    const userMap = new Map();
    if (dbUsers && dbUsers.length > 0) {
      dbUsers.forEach((u) => {
        const uObj = u.toObject ? u.toObject() : u;
        userMap.set(uObj._id.toString(), uObj);
      });
    }

    // Decorate users with conversation details (WhatsApp style)
    const decoratedUsers = Array.from(userMap.values()).map((user) => {
      const meta = conversationMap.get(user._id.toString());
      return {
        ...user,
        lastMessage: meta?.lastMessage || null,
        lastMessageTime: meta?.lastMessageTime || null,
        unreadCount: meta?.unreadCount || 0,
        hasConversation: Boolean(meta),
      };
    });

    return res.status(200).json(decoratedUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id?.toString();
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const cursor = req.query.cursor;

    if (mongoose.connection.readyState === 1) {
      try {
        const myObjectId = mongoose.Types.ObjectId.isValid(myId)
          ? new mongoose.Types.ObjectId(myId)
          : myId;
        const chatObjectId = mongoose.Types.ObjectId.isValid(userToChatId)
          ? new mongoose.Types.ObjectId(userToChatId)
          : userToChatId;

        const query = {
          $or: [
            { senderId: myObjectId, receiverId: chatObjectId },
            { senderId: chatObjectId, receiverId: myObjectId },
            { senderId: myId, receiverId: userToChatId },
            { senderId: userToChatId, receiverId: myId },
          ],
        };

        if (cursor) {
          query.createdAt = { $lt: new Date(cursor) };
        }

        // Retrieve newest messages first to get the immediate window
        const rawMessages = await Message.find(query)
          .sort({ createdAt: -1 })
          .limit(limit + 1);

        const hasMore = rawMessages.length > limit;
        const paginatedMessages = hasMore ? rawMessages.slice(0, limit) : rawMessages;

        // Reverse to chronological order (oldest to newest)
        const messages = paginatedMessages.reverse();
        const nextCursor = hasMore && messages.length > 0 ? messages[0].createdAt : null;

        res.setHeader("X-Has-More", hasMore ? "true" : "false");
        if (nextCursor) {
          res.setHeader("X-Next-Cursor", new Date(nextCursor).toISOString());
        }

        if (cursor !== undefined || req.query.paginated === "true") {
          return res.status(200).json({
            messages,
            nextCursor,
            hasMore,
          });
        }

        return res.status(200).json(messages);
      } catch (dbErr) {
        console.warn("DB query failed in getMessages, checking in-memory messages:", dbErr.message);
      }
    }

    // In-memory fallback
    const filtered = inMemoryMessages.filter(
      (m) =>
        (m.senderId === myId && m.receiverId === userToChatId) ||
        (m.senderId === userToChatId && m.receiverId === myId)
    );

    if (cursor !== undefined || req.query.paginated === "true") {
      return res.status(200).json({
        messages: filtered,
        nextCursor: null,
        hasMore: false,
      });
    }

    return res.status(200).json(filtered);
  } catch (error) {
    console.error("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id?.toString();

    let imageUrl = null;
    if (image) {
      try {
        if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY !== "undefined") {
          const uploadResponse = await cloudinary.uploader.upload(image);
          imageUrl = uploadResponse.secure_url;
        } else {
          imageUrl = image;
        }
      } catch (uploadErr) {
        console.warn("Cloudinary image upload failed, falling back to data URL:", uploadErr.message);
        imageUrl = image;
      }
    }

    let audioUrl = null;
    if (audio) {
      try {
        if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY !== "undefined") {
          const uploadResponse = await cloudinary.uploader.upload(audio, {
            resource_type: "auto",
            folder: "chat_audio",
          });
          audioUrl = uploadResponse.secure_url;
        } else {
          audioUrl = audio;
        }
      } catch (uploadErr) {
        console.warn("Cloudinary audio upload failed, falling back to data URL:", uploadErr.message);
        audioUrl = audio;
      }
    }

    const receiverSocketId = getReceiverSocketId(receiverId);
    const initialStatus = receiverSocketId ? "delivered" : "sent";

    if (mongoose.connection.readyState === 1) {
      try {
        const newMessage = new Message({
          senderId,
          receiverId,
          text: text || "",
          image: imageUrl,
          audio: audioUrl,
          status: initialStatus,
          reactions: [],
        });

        await newMessage.save();

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("newMessage", newMessage);
        }

        return res.status(201).json(newMessage);
      } catch (dbErr) {
        console.warn("DB save failed in sendMessage, falling back to in-memory message:", dbErr.message);
      }
    }

    const inMemMsg = {
      _id: "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      senderId,
      receiverId,
      text: text || "",
      image: imageUrl,
      audio: audioUrl,
      status: initialStatus,
      reactions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryMessages.push(inMemMsg);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", inMemMsg);
    }

    res.status(201).json(inMemMsg);
  } catch (error) {
    console.error("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { senderId } = req.params;
    const myId = req.user._id?.toString();

    let modifiedCount = 0;
    if (mongoose.connection.readyState === 1) {
      try {
        const result = await Message.updateMany(
          {
            senderId: senderId,
            receiverId: myId,
            status: { $ne: "read" },
          },
          {
            $set: { status: "read" },
          }
        );
        modifiedCount = result.modifiedCount;
      } catch (dbErr) {
        console.warn("DB update failed in markMessagesAsRead:", dbErr.message);
      }
    }

    inMemoryMessages.forEach((m) => {
      if (m.senderId === senderId && m.receiverId === myId) {
        m.status = "read";
      }
    });

    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messages:read", {
        readerId: myId,
        senderId: senderId,
      });
    }

    res.status(200).json({
      message: "Messages marked as read",
      modifiedCount,
    });
  } catch (error) {
    console.error("Error in markMessagesAsRead: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const myId = req.user._id?.toString();

    if (!emoji) {
      return res.status(400).json({ message: "Emoji is required" });
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const message = await Message.findById(messageId);
        if (message) {
          const existingIndex = message.reactions.findIndex(
            (r) => r.userId.toString() === myId && r.emoji === emoji
          );

          if (existingIndex > -1) {
            message.reactions.splice(existingIndex, 1);
          } else {
            const userOtherIndex = message.reactions.findIndex(
              (r) => r.userId.toString() === myId
            );
            if (userOtherIndex > -1) {
              message.reactions[userOtherIndex].emoji = emoji;
            } else {
              message.reactions.push({ userId: myId, emoji });
            }
          }

          await message.save();

          const payload = {
            messageId: message._id,
            reactions: message.reactions,
          };

          const senderSocketId = getReceiverSocketId(message.senderId.toString());
          const receiverSocketId = getReceiverSocketId(message.receiverId.toString());

          if (senderSocketId) io.to(senderSocketId).emit("message:reaction", payload);
          if (receiverSocketId) io.to(receiverSocketId).emit("message:reaction", payload);

          return res.status(200).json(message);
        }
      } catch (dbErr) {
        console.warn("DB react failed, falling back to in-memory:", dbErr.message);
      }
    }

    // In-memory fallback
    const memMsg = inMemoryMessages.find((m) => m._id === messageId);
    if (memMsg) {
      if (!memMsg.reactions) memMsg.reactions = [];
      const exIdx = memMsg.reactions.findIndex((r) => r.userId === myId && r.emoji === emoji);
      if (exIdx > -1) {
        memMsg.reactions.splice(exIdx, 1);
      } else {
        memMsg.reactions.push({ userId: myId, emoji });
      }
      return res.status(200).json(memMsg);
    }

    return res.status(404).json({ message: "Message not found" });
  } catch (error) {
    console.error("Error in reactToMessage: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
