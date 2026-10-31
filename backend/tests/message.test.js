import request from "supertest";
import { app } from "../src/index.js";
import User from "../src/models/user.model.js";
import Message from "../src/models/message.model.js";
import { connectTestDB, closeTestDB, clearTestDB } from "./setup.js";

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

describe("Message Endpoints", () => {
  let user1, user2, cookie1, cookie2;

  beforeEach(async () => {
    // Register two users
    const res1 = await request(app).post("/api/auth/signup").send({
      fullName: "User One",
      email: "user1@example.com",
      password: "password123",
    });
    user1 = res1.body;
    cookie1 = res1.headers["set-cookie"];

    const res2 = await request(app).post("/api/auth/signup").send({
      fullName: "User Two",
      email: "user2@example.com",
      password: "password123",
    });
    user2 = res2.body;
    cookie2 = res2.headers["set-cookie"];
  });

  describe("POST /api/messages/send/:id", () => {
    it("should successfully send a text message", async () => {
      const res = await request(app)
        .post(`/api/messages/send/${user2._id}`)
        .set("Cookie", cookie1)
        .send({ text: "Hello from User One!" });

      expect(res.status).toBe(201);
      expect(res.body.text).toBe("Hello from User One!");
      expect(res.body.senderId).toBe(user1._id);
      expect(res.body.receiverId).toBe(user2._id);
      expect(res.body.status).toBeDefined();
    });

    it("should reject message if text, image, and audio are all missing", async () => {
      const res = await request(app)
        .post(`/api/messages/send/${user2._id}`)
        .set("Cookie", cookie1)
        .send({ text: "   " });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Message must contain text, an image, or an audio recording/i);
    });

    it("should allow sending message with audio voice note", async () => {
      const res = await request(app)
        .post(`/api/messages/send/${user2._id}`)
        .set("Cookie", cookie1)
        .send({ audio: "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8USA==" });

      expect(res.status).toBe(201);
      expect(res.body.audio).toBeDefined();
    });
  });

  describe("GET /api/messages/:id (Cursor Pagination)", () => {
    beforeEach(async () => {
      // Seed 10 sequential messages
      const baseTime = Date.now() - 100000;
      for (let i = 0; i < 10; i++) {
        const msg = new Message({
          senderId: i % 2 === 0 ? user1._id : user2._id,
          receiverId: i % 2 === 0 ? user2._id : user1._id,
          text: `Message number ${i + 1}`,
          createdAt: new Date(baseTime + i * 1000),
        });
        await msg.save();
      }
    });

    it("should retrieve messages with cursor pagination", async () => {
      // Retrieve first page with limit 4
      const page1Res = await request(app)
        .get(`/api/messages/${user2._id}?limit=4&paginated=true`)
        .set("Cookie", cookie1);

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.messages).toHaveLength(4);
      expect(page1Res.body.hasMore).toBe(true);
      expect(page1Res.body.nextCursor).toBeDefined();

      // Retrieve older page using cursor
      const oldestOfPage1 = page1Res.body.nextCursor;
      const page2Res = await request(app)
        .get(`/api/messages/${user2._id}?cursor=${encodeURIComponent(oldestOfPage1)}&limit=4`)
        .set("Cookie", cookie1);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.messages.length).toBeGreaterThan(0);
      // Older messages should have earlier created timestamp than oldestOfPage1
      const isOlder = new Date(page2Res.body.messages[0].createdAt) < new Date(oldestOfPage1);
      expect(isOlder).toBe(true);
    });
  });

  describe("PATCH /api/messages/read/:senderId", () => {
    it("should mark unread messages from a sender as read", async () => {
      // User 2 sends a message to User 1
      const msg = new Message({
        senderId: user2._id,
        receiverId: user1._id,
        text: "Unread message",
        status: "sent",
      });
      await msg.save();

      // User 1 marks messages from User 2 as read
      const res = await request(app)
        .patch(`/api/messages/read/${user2._id}`)
        .set("Cookie", cookie1);

      expect(res.status).toBe(200);
      expect(res.body.modifiedCount).toBe(1);

      const updated = await Message.findById(msg._id);
      expect(updated.status).toBe("read");
    });
  });

  describe("POST /api/messages/react/:messageId", () => {
    it("should toggle emoji reaction on a message", async () => {
      const msg = new Message({
        senderId: user2._id,
        receiverId: user1._id,
        text: "Awesome feature!",
      });
      await msg.save();

      // User 1 reacts with heart
      const reactRes = await request(app)
        .post(`/api/messages/react/${msg._id}`)
        .set("Cookie", cookie1)
        .send({ emoji: "❤️" });

      expect(reactRes.status).toBe(200);
      expect(reactRes.body.reactions).toHaveLength(1);
      expect(reactRes.body.reactions[0].emoji).toBe("❤️");

      // User 1 reacts with heart again (should toggle off)
      const toggleRes = await request(app)
        .post(`/api/messages/react/${msg._id}`)
        .set("Cookie", cookie1)
        .send({ emoji: "❤️" });

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.reactions).toHaveLength(0);
    });
  });
});
