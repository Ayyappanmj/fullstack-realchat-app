import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import dns from "dns";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5001;

app.set("trust proxy", 1);

// Secure HTTP headers with helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Express body parsers (support base64 images and audio blobs)
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());

// CORS setup
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://fullstack-realchat-frontend.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".onrender.com") ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // generous for development, testing, and recruiter switches
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts, please try again in 15 minutes." },
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many messaging requests, please slow down." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageLimiter, messageRoutes);

// Health check endpoint (keeps Render container warm and responsive)
app.get(["/health", "/api/health"], (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

const frontendDist = path.resolve(__dirname, "../../frontend/dist");
const rootDist = path.resolve(process.cwd(), "frontend/dist");
const distPath = fs.existsSync(frontendDist) ? frontendDist : rootDist;

if (process.env.NODE_ENV === "production" && fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Only start the server if this file is executed directly (not when imported in tests)
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    connectDB();
  });
}

export { app, server };
