import { Worker } from "bullmq";
import { redisConnectionOptions } from "../config/redis";
new Worker("forumQueue", async (job) => {
    console.log(`Scanning forum index for job ${job.id ?? "unknown"}...`);
}, {
    connection: redisConnectionOptions,
    concurrency: 5,
});
