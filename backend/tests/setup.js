import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// Increase default hook/test timeout to allow MongoMemoryServer extraction on Windows
if (typeof jest !== "undefined") {
  jest.setTimeout(60000);
}

let mongoServer;

export const connectTestDB = async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test_secret_key_1234567890_antigravity";

  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        launchTimeout: 60000,
      },
    });
  }
  const uri = mongoServer.getUri();

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
};

export const closeTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};

export const clearTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
};
