import { Queue } from "bullmq";
import { redisConnectionOptions } from "./redis";

export const forumQueue = new Queue("forumQueue", {
  connection: redisConnectionOptions,
});

export const boardQueue = new Queue("boardQueue", {
  connection: redisConnectionOptions,
});

export const topicQueue = new Queue("topicQueue", {
  connection: redisConnectionOptions,
});

export const mentionQueue = new Queue("mentionQueue", {
  connection: redisConnectionOptions,
});

export const sentMeritQueue = new Queue("sentMeritQueue", {
  connection: redisConnectionOptions,
});

export const receivedMeritQueue = new Queue("receivedMeritQueue", {
  connection: redisConnectionOptions,
});

export const replyQueue = new Queue("replyQueue", {
  connection: redisConnectionOptions,
});

export const postQueue = new Queue("postQueue", {
  connection: redisConnectionOptions,
});

export const boardSpamQueue = new Queue("boardSpamQueue", {
  connection: redisConnectionOptions,
});

