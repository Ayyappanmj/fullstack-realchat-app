import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import mongoose from "mongoose";
import { DEMO_USERS } from "../lib/demoUsers.js";

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Database connection unavailable. Please check MONGODB_URI in Render settings.",
      });
    }

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    await newUser.save();
    generateToken(newUser._id, res);

    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      profilePic: newUser.profilePic,
    });
  } catch (error) {
    console.error("Error in signup controller:", error.message);
    res.status(500).json({ message: error.message || "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1-Click Fast-Track Demo Login (guaranteed to succeed for reviewers/recruiters even if DB is offline)
    if (DEMO_USERS[normalizedEmail] && password === "demo1234") {
      const demoUser = DEMO_USERS[normalizedEmail];

      if (mongoose.connection.readyState === 1) {
        try {
          let user = await User.findOne({ email: normalizedEmail });
          if (!user) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash("demo1234", salt);
            user = new User({
              _id: demoUser._id,
              fullName: demoUser.fullName,
              email: normalizedEmail,
              password: hashedPassword,
              profilePic: demoUser.profilePic,
            });
            await user.save();
          } else {
            const isMatch = await bcrypt.compare("demo1234", user.password);
            if (!isMatch) {
              const salt = await bcrypt.genSalt(10);
              user.password = await bcrypt.hash("demo1234", salt);
              await user.save();
            }
          }
        } catch (dbErr) {
          console.warn("MongoDB sync failed for demo user, continuing in-memory:", dbErr.message);
        }
      }

      generateToken(demoUser._id, res);
      return res.status(200).json({
        _id: demoUser._id,
        fullName: demoUser.fullName,
        email: demoUser.email,
        profilePic: demoUser.profilePic,
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Database connection unavailable. Please check MONGODB_URI in Render settings.",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.error("Error in login controller:", error.message);
    res.status(500).json({ message: error.message || "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("jwt", "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: isProduction ? "none" : "strict",
      secure: isProduction,
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user._id;

    if (!profilePic) {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    let secureUrl = profilePic;
    if (profilePic.startsWith("data:")) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(profilePic);
        secureUrl = uploadResponse.secure_url;
      } catch (uploadErr) {
        console.warn("Cloudinary upload failed, storing direct avatar string:", uploadErr.message);
      }
    }

    if (mongoose.connection.readyState === 1) {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { profilePic: secureUrl },
        { new: true }
      ).select("-password");
      return res.status(200).json(updatedUser);
    }

    const demoUser = Object.values(DEMO_USERS).find((u) => u._id.toString() === userId.toString());
    if (demoUser) {
      demoUser.profilePic = secureUrl;
      return res.status(200).json(demoUser);
    }

    return res.status(200).json({ ...req.user, profilePic: secureUrl });
  } catch (error) {
    console.error("Error in update profile:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.error("Error in checkAuth controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
