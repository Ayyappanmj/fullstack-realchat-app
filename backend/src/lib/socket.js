import { Server } from "socket.io";
import http from "http";
import express from "express";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://fullstack-realchat-frontend.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".onrender.com") ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  },
  maxHttpBufferSize: 1e7, // 10MB
});

// Configure horizontal Redis adapter if REDIS_URL is provided
if (process.env.REDIS_URL) {
  try {
    const pubClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // don't hang if redis is unreachable
    });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => {
      console.warn("Redis Pub Client warning:", err.message);
    });
    subClient.on("error", (err) => {
      console.warn("Redis Sub Client warning:", err.message);
    });

    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.io Redis adapter initialized");
  } catch (error) {
    console.warn("Failed to initialize Redis adapter, falling back to in-memory:", error.message);
  }
} else {
  console.log("Using Socket.io default in-memory adapter");
}

// used to store online users: { userId: socketId }
const userSocketMap = {};

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

export function getAllOnlineUsers() {
  return Object.keys(userSocketMap);
}

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
  }

  // Broadcast current online user list
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Typing indicators
  socket.on("typing:start", ({ receiverId }) => {
    if (!receiverId) return;
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing:start", { senderId: userId });
    }
  });

  socket.on("typing:stop", ({ receiverId }) => {
    if (!receiverId) return;
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing:stop", { senderId: userId });
    }
  });

  // Client notifications for message read
  socket.on("message:read", ({ senderId }) => {
    if (!senderId) return;
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messages:read", {
        readerId: userId,
      });
    }
  });

  // WebRTC P2P Video/Audio Calling Signaling
  socket.on("call:user", ({ userToCall, signalData, from, callerName, callerPic, callType }) => {
    const receiverSocketId = getReceiverSocketId(userToCall);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call:incoming", {
        signal: signalData,
        from,
        callerName,
        callerPic,
        callType: callType || "video",
      });
    } else {
      socket.emit("call:unavailable", { userToCall });
    }
  });

  socket.on("call:accepted", ({ to, signal }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call:accepted", { signal });
    }
  });

  socket.on("call:rejected", ({ to }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call:rejected");
    }
  });

  socket.on("call:ended", ({ to }) => {
    const peerSocketId = getReceiverSocketId(to);
    if (peerSocketId) {
      io.to(peerSocketId).emit("call:ended");
    }
  });

  socket.on("ice:candidate", ({ to, candidate }) => {
    const peerSocketId = getReceiverSocketId(to);
    if (peerSocketId) {
      io.to(peerSocketId).emit("ice:candidate", { candidate });
    }
  });

  socket.on("disconnect", () => {
    if (userId) {
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
