import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { protectRoute } from "../src/middleware/auth.middleware.js";
import User from "../src/models/user.model.js";
import { connectTestDB, closeTestDB, clearTestDB } from "./setup.js";

const testApp = express();
testApp.use(cookieParser());
testApp.get("/protected", protectRoute, (req, res) => {
  res.status(200).json({ user: req.user });
});

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

describe("Auth Middleware - protectRoute", () => {
  it("should return 401 when no token is provided", async () => {
    const res = await request(testApp).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Unauthorized - No Token Provided/i);
  });

  it("should return 500 or 401 when invalid token format is provided", async () => {
    const res = await request(testApp)
      .get("/protected")
      .set("Cookie", ["jwt=invalid.token.here"]);

    expect([401, 500]).toContain(res.status);
  });

  it("should return 404 when token references a deleted/non-existent user", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const token = jwt.sign(
      { userId: fakeId },
      process.env.JWT_SECRET || "default_chat_app_jwt_secret_dev_testing"
    );

    const res = await request(testApp)
      .get("/protected")
      .set("Cookie", [`jwt=${token}`]);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/User not found/i);
  });

  it("should grant access and populate req.user when valid token is provided", async () => {
    const user = new User({
      fullName: "Middleware Tester",
      email: "mw@example.com",
      password: "hashedpassword123",
    });
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "default_chat_app_jwt_secret_dev_testing"
    );

    const res = await request(testApp)
      .get("/protected")
      .set("Cookie", [`jwt=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.user._id).toBe(user._id.toString());
    expect(res.body.user.email).toBe("mw@example.com");
  });
});
