import { z } from "zod";

export const signupSchema = z.object({
  fullName: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(2, "Full name must be at least 2 characters"),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email address"),
  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email address"),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required"),
});

export const messageSchema = z
  .object({
    text: z.string().optional().default(""),
    image: z.string().optional().nullable(),
    audio: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      const hasText = typeof data.text === "string" && data.text.trim().length > 0;
      const hasImage = Boolean(data.image);
      const hasAudio = Boolean(data.audio);
      return hasText || hasImage || hasAudio;
    },
    {
      message: "Message must contain text, an image, or an audio recording",
    }
  );

export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return res.status(400).json({
        message: firstIssue?.message || "Invalid input data",
        errors: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    }
    return res.status(400).json({ message: "Malformed request payload" });
  }
};
