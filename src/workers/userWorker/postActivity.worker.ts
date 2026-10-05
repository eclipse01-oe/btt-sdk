import { Worker } from "bullmq";
import { redisConnectionOptions } from "../../config/redis";
import { activityPage } from "../../controller/userUrl.controller";
import { callActivity } from "../../scrappers/userScrappers/activity.scrapper";
import { getActivity, updateActivity } from "../../utils/activity.utils";
import { eventBus } from "../../event/eventBus";
import { getReq } from "../../services/req.services";
import * as r from "../../config/redis";
import * as err from "../../utils/error.utils";
console.log("📦 postActivity.worker.ts loaded");
const worker = new Worker("postQueue", async (job) => {
    console.log("▶ Processing post job");
    const { username, jobId } = job.data;
    const page = err.nullCheck(await activityPage(username, getReq()), "⚠️ Activity page not found");
    const postsPage = err.nullCheck(page.postsPage, "⚠️ Post page not found");
    const post = await callActivity(getReq(), postsPage, "post");
    if (!post) {
        console.log(`ℹ️ ${username} has no posts`);
        return;
    }
    const eventAt = err.nullCheck(post.eventAt, `⚠️ Post missing eventAt for ${username}`);
    const dbActivity = await getActivity(username, "post");
    const redisActivity = await r.getRedisField(`watch-post:${username}`, "eventAt");
    const stored = redisActivity || dbActivity?.get("eventAt");
    if (!stored) {
        await r.setRedis(`watch-post:${username}`, {
            eventAt: eventAt.toISOString(),
            jobId,
        });
        return;
    }
    const current = new Date(eventAt).getTime();
    const previous = new Date(stored as Date).getTime();
    if (current > previous) {
        eventBus.emit("activity:post", {
            username,
            data: post,
        });
        await updateActivity(username, "post", post);
        await r.updateRedisFields(`watch-post:${username}`, {
            eventAt: eventAt.toISOString(),
            jobId,
        });
        console.log(`✅ New post found for ${username}`);
        return post;
    }
}, {
    connection: redisConnectionOptions,
});
worker.on("ready", () => {
    console.log("🟢 postQueue worker ready");
});
worker.on("active", (job) => {
    console.log(`▶ Job active: ${job.name}`);
});
worker.on("completed", (job) => {
    console.log(`✅ Job completed: ${job.name}`);
});
worker.on("failed", (job, err) => {
    console.log(`❌ Job failed: ${job?.name}`);
    console.error(err);
});
