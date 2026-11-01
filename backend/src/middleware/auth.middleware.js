import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import mongoose from "mongoose";
import { DEMO_USERS } from "../lib/demoUsers.js";

export const protectRoute = async (req, res, next) => {
  try {
    let token = req.cookies?.jwt;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No Token Provided" });
    }

    const secret = process.env.JWT_SECRET || "default_chat_app_jwt_secret_dev_testing";
    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    // Check demo users fast-path (guaranteed availability for reviewer/recruiter testing)
    const demoUser = Object.values(DEMO_USERS).find(
      (u) => u._id.toString() === decoded.userId.toString()
    );
    if (demoUser) {
      req.user = demoUser;
      return next();
    }

    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(decoded.userId).select("-password");
      if (user) {
        req.user = user;
        return next();
      }
    }

    return res.status(404).json({ message: "User not found" });
  } catch (error) {
    console.error("Error in protectRoute middleware: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
