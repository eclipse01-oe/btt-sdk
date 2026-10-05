import mongoose from "mongoose";
import { env } from "./zod";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("MongoDB Connection Failed:", err);

    process.exit(1);
  }
};
