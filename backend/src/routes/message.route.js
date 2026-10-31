import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMessages,
  getUsersForSidebar,
  sendMessage,
  markMessagesAsRead,
  reactToMessage,
} from "../controllers/message.controller.js";
import { validate, messageSchema } from "../middleware/validate.middleware.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, validate(messageSchema), sendMessage);
router.patch("/read/:senderId", protectRoute, markMessagesAsRead);
router.post("/react/:messageId", protectRoute, reactToMessage);

export default router;
