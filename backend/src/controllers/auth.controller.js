import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import mongoose from "mongoose";

const DEMO_ACCOUNTS = {
  "noby@demo.com": {
    fullName: "Noby",
    profilePic: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
  },
  "elsa@demo.com": {
    fullName: "Elsa",
    profilePic: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  },
  "alice@demo.com": {
    fullName: "Elsa",
    profilePic: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  },
  "bob@demo.com": {
    fullName: "Noby",
    profilePic: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
  },
};

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
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    // Auto-provision demo accounts if requested and missing
    if (!user && DEMO_ACCOUNTS[normalizedEmail]) {
      const demoMeta = DEMO_ACCOUNTS[normalizedEmail];
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password || "demo1234", salt);

      user = new User({
        fullName: demoMeta.fullName,
        email: normalizedEmail,
        password: hashedPassword,
        profilePic: demoMeta.profilePic,
      });
      await user.save();
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      // If demo account with password demo1234, auto-heal if password was modified
      if (DEMO_ACCOUNTS[normalizedEmail] && password === "demo1234") {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash("demo1234", salt);
        await user.save();
      } else {
        return res.status(400).json({ message: "Invalid credentials" });
      }
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
    res.status(500).json({ message: "Internal Server Error" });
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
    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY !== "undefined") {
      try {
        const uploadResponse = await cloudinary.uploader.upload(profilePic);
        secureUrl = uploadResponse.secure_url;
      } catch (uploadErr) {
        console.warn("Cloudinary upload failed, storing direct avatar string:", uploadErr.message);
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: secureUrl },
      { new: true }
    ).select("-password");

    res.status(200).json(updatedUser);
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
