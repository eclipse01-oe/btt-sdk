import mongoose from "mongoose";
import { redis } from "../config/redis";
import { connectDB } from "../config/db";

async function clearRedis() {
  console.log("🧹 Flushing Redis...");
  await redis.flushall();
  console.log("✅ Redis flushed");
}

async function clearMongo() {
  console.log("🧹 Dropping MongoDB database...");
  await connectDB();

  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("MongoDB connection not established");
  }

  await db.dropDatabase();
  console.log("✅ MongoDB database dropped");
}

async function main() {
  try {
    await clearRedis();
    await clearMongo();
    console.log("🎉 Redis and MongoDB cleared");
  } catch (err) {
    console.error("❌ Failed to clear:", err);
    process.exitCode = 1;
  } finally {
    await redis.quit();
    await mongoose.disconnect();
    process.exit(process.exitCode ?? 0);
  }
}

main();
