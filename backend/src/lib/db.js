import mongoose from "mongoose";

export const connectDB = async () => {
  if (process.env.MONGODB_URI) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 4000,
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.warn(
        `Remote MongoDB connection failed (${error.message}). Falling back to local embedded MongoDB...`
      );
    }
  }

  // Graceful fallback to embedded MongoDB instance for offline local development & instant testing
  try {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    const conn = await mongoose.connect(uri);
    console.log(`Embedded MongoDB connected successfully: ${conn.connection.host}`);
  } catch (memError) {
    console.error("MongoDB fallback connection error:", memError.message);
  }
};
