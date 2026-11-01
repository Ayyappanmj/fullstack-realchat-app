import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {
  const secret = process.env.JWT_SECRET || "default_chat_app_jwt_secret_dev_testing";
  const token = jwt.sign({ userId }, secret, {
    expiresIn: "7d",
  });

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true" ||
    process.env.PORT !== undefined;

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // MS
    httpOnly: true, // prevent XSS
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  });

  return token;
};
