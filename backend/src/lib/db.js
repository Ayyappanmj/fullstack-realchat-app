import mongoose from "mongoose";
import dns from "dns";

// Ensure DNS resolution for mongodb+srv records works reliably across all host environments
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore in sandboxed environments where setServers is restricted
}

export const connectDB = async () => {
  if (process.env.MONGODB_URI) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        family: 4,
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(
        `Remote MongoDB connection failed: ${error.message}. Please verify MONGODB_URI and Network Access (0.0.0.0/0) in MongoDB Atlas.`
      );
    }
  } else {
    console.warn("MONGODB_URI is not set in environment variables.");
  }

  // Graceful fallback to embedded MongoDB instance for offline local development & testing only
  if (process.env.NODE_ENV !== "production") {
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();
      const conn = await mongoose.connect(uri, { family: 4 });
      console.log(`Embedded MongoDB connected successfully: ${conn.connection.host}`);
    } catch (memError) {
      console.error("MongoDB fallback connection error:", memError.message);
    }
  }
};
