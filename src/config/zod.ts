import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  quiet: true,
});

const envSchema = z.object({
  URL: z.string(),
  BASE_URL: z.string(),
  USER_AGENT: z.string(),
  ACCEPT: z.string(),
  ACCEPT_LANGUAGE: z.string(),
  MONGO_URI: z.string(),
  REDIS_PORT: z.coerce.number(),
  REDIS_URL: z.string(),
  COOKIES: z.string(),
  LOGIN_PAGE: z.string(),
  USERNAME: z.string(),
  PASSWORD: z.string(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
