import IORedis, { type RedisOptions } from "ioredis";
import { env } from "./zod";

const parseRedisUrl = (url: string): RedisOptions | null => {
  try {
    const parsed = new URL(url);

    if (!parsed.hostname) {
      return null;
    }

    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : env.REDIS_PORT,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    };
  } catch {
    return null;
  }
};

export const redisConnectionOptions: RedisOptions = {
  host: "redis",
  port: env.REDIS_PORT,
  ...(env.REDIS_URL ? parseRedisUrl(env.REDIS_URL) : null),
  lazyConnect: true,
};

export const redis = new IORedis(redisConnectionOptions);

redis.on("error", (error) => {
  console.error("[Redis]:", error.message);
});

/* ---------------- HASHES ---------------- */

export const setRedis = async (key: string, data: Record<string, any>) => redis.hset(key, data);

export const getRedisField = async (key: string, field: string) => {
  const value = await redis.hget(key, field);
  return value ?? null;
};

export const getMultipleRedisField = async (key: string, fields: string[]) => {
  const values = await redis.hmget(key, ...fields);

  return values.every((v) => v === null) ? null : values;
};

export const getAllRedis = async (key: string) => {
  const data = await redis.hgetall(key);

  return Object.keys(data).length === 0 ? null : data;
};

/**
 * Update one field
 */
export const updateRedisField = async (key: string, field: string, value: any) =>
  redis.hset(key, field, value);

/**
 * Update many fields
 */
export const updateRedisFields = async (key: string, data: Record<string, any>) =>
  redis.hset(key, data);

/**
 * Delete one field from hash
 */
export const deleteRedisField = async (key: string, field: string) => redis.hdel(key, field);

/**
 * Delete multiple fields from hash
 */
export const deleteRedisFields = async (key: string, fields: string[]) =>
  redis.hdel(key, ...fields);

/**
 * Check if field exists
 */
export const redisFieldExists = async (key: string, field: string) => {
  const exists = await redis.hexists(key, field);
  return exists === 1;
};

/**
 * Check if hash exists
 */
export const redisKeyExists = async (key: string) => {
  const exists = await redis.exists(key);
  return exists === 1;
};

/**
 * Delete entire hash
 */
export const deleteRedis = async (key: string) => redis.del(key);

/**
 * Rename key
 */
export const renameRedisKey = async (oldKey: string, newKey: string) =>
  redis.rename(oldKey, newKey);

/**
 * Set expiration
 */
export const expireRedis = async (key: string, seconds: number) => redis.expire(key, seconds);

/**
 * Get TTL
 */
export const getRedisTTL = async (key: string) => {
  const ttl = await redis.ttl(key);
  return ttl < 0 ? null : ttl;
};

/* ---------------- SETS ---------------- */

export const addRedisUser = async (setName: string, username: string) =>
  redis.sadd(setName, username);

export const removeRedisUser = async (setName: string, username: string) =>
  redis.srem(setName, username);

export const getRedisUsers = async (setName: string) => {
  const users = await redis.smembers(setName);
  return users.length === 0 ? null : users;
};

export const redisUserExists = async (setName: string, username: string) => {
  const exists = await redis.sismember(setName, username);
  return exists === 1;
};

export const redisUserCount = async (setName: string) => {
  const count = await redis.scard(setName);
  return count === 0 ? null : count;
};

export const deleteRedisSet = async (setName: string) => redis.del(setName);

/* ---------------- KEYS ---------------- */

export const getKeys = async (pattern: string) => {
  const keys = await redis.keys(pattern);
  return keys.length === 0 ? null : keys;
};
