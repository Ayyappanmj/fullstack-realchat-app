import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const cursor = req.query.cursor;

    const query = {
      $or: [
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

    // If query has cursor or paginated flag, return structured object
    if (cursor !== undefined || req.query.paginated === "true") {
      return res.status(200).json({
        messages,
        nextCursor,
        hasMore,
      });
    }

    // For standard unpaginated requests, return messages array directly
    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

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

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { senderId } = req.params;
    const myId = req.user._id;

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

    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messages:read", {
        readerId: myId,
        senderId: senderId,
      });
    }

    res.status(200).json({
      message: "Messages marked as read",
      modifiedCount: result.modifiedCount,
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
    const myId = req.user._id;

    if (!emoji) {
      return res.status(400).json({ message: "Emoji is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Toggle reaction: if exists from this user with same emoji, remove it
    const existingIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === myId.toString() && r.emoji === emoji
    );

    if (existingIndex > -1) {
      message.reactions.splice(existingIndex, 1);
    } else {
      // If user had another emoji, replace it, otherwise push
      const userOtherIndex = message.reactions.findIndex(
        (r) => r.userId.toString() === myId.toString()
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

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in reactToMessage: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
