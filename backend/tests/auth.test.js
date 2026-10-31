import request from "supertest";
import { app } from "../src/index.js";
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

describe("Auth Endpoints", () => {
  describe("POST /api/auth/signup", () => {
    it("should successfully register a new user and set JWT cookie", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          fullName: "Test User",
          email: "test@example.com",
          password: "password123",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.fullName).toBe("Test User");
      expect(res.body.email).toBe("test@example.com");
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("should fail validation if password is shorter than 6 characters", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          fullName: "Test User",
          email: "test@example.com",
          password: "123",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Password must be at least 6 characters/i);
    });

    it("should fail validation if email is invalid", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          fullName: "Test User",
          email: "invalid-email",
          password: "password123",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid email address/i);
    });

    it("should not allow duplicate email registration", async () => {
      await request(app).post("/api/auth/signup").send({
        fullName: "First User",
        email: "duplicate@example.com",
        password: "password123",
      });

      const res = await request(app).post("/api/auth/signup").send({
        fullName: "Second User",
        email: "duplicate@example.com",
        password: "password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Email already exists/i);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login registered user successfully", async () => {
      await request(app).post("/api/auth/signup").send({
        fullName: "Login Tester",
        email: "login@example.com",
        password: "password123",
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "login@example.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe("login@example.com");
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("should auto-provision recruiter demo accounts (Noby & Elsa)", async () => {
      const nobyRes = await request(app).post("/api/auth/login").send({
        email: "noby@demo.com",
        password: "demo1234",
      });

      expect(nobyRes.status).toBe(200);
      expect(nobyRes.body.fullName).toBe("Noby");
      expect(nobyRes.body.email).toBe("noby@demo.com");
      expect(nobyRes.headers["set-cookie"]).toBeDefined();

      const elsaRes = await request(app).post("/api/auth/login").send({
        email: "elsa@demo.com",
        password: "demo1234",
      });

      expect(elsaRes.status).toBe(200);
      expect(elsaRes.body.fullName).toBe("Elsa");
      expect(elsaRes.body.email).toBe("elsa@demo.com");
    });

    it("should reject incorrect password", async () => {
      await request(app).post("/api/auth/signup").send({
        fullName: "Login Tester",
        email: "login2@example.com",
        password: "correctpassword",
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "login2@example.com",
        password: "wrongpassword",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid credentials/i);
    });
  });

  describe("GET /api/auth/check", () => {
    it("should return user info when authenticated via cookie", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send({
        fullName: "Check Tester",
        email: "check@example.com",
        password: "password123",
      });

      const cookie = signupRes.headers["set-cookie"];

      const checkRes = await request(app)
        .get("/api/auth/check")
        .set("Cookie", cookie);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.email).toBe("check@example.com");
    });

    it("should return 401 when no cookie is sent", async () => {
      const res = await request(app).get("/api/auth/check");
      expect(res.status).toBe(401);
    });
  });
});
