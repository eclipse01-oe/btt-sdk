import { Worker } from "bullmq";
import { redisConnectionOptions } from "../../config/redis";
import { activityPage } from "../../controller/userUrl.controller";
import { callActivity } from "../../scrappers/userScrappers/activity.scrapper";
import { getActivity, updateActivity } from "../../utils/activity.utils";
import { eventBus } from "../../event/eventBus";
import { getReq } from "../../services/req.services";
import * as r from "../../config/redis";
import * as err from "../../utils/error.utils";
const worker = new Worker("replyQueue", async (job) => {
    const { username, jobId } = job.data;
    console.log(`🔍 Checking post for ${username} with jobId: ${jobId}`);
    const page = err.nullCheck(await activityPage(username, getReq()), "⚠️ Activity page not found");
    const repliesPage = err.nullCheck(page.repliesPage, "⚠️ Reply page not found");
    const reply = await callActivity(getReq(), repliesPage, "reply");
    if (!reply) {
        console.log(`ℹ️ ${username} has no replies`);
        return;
    }
    const eventAt = err.nullCheck(reply.eventAt, `⚠️ Reply missing eventAt for ${username}`);
    const dbActivity = await getActivity(username, "reply");
    const redisActivity = await r.getRedisField(`watch-reply:${username}`, "eventAt");
    const stored = redisActivity || dbActivity?.get("eventAt");
    if (!stored) {
        await r.setRedis(`watch-reply:${username}`, {
            eventAt: eventAt.toISOString(),
            jobId,
        });
        return;
    }
    const current = new Date(eventAt).getTime();
    const previous = new Date(stored as Date).getTime();
    if (current > previous) {
        eventBus.emit("activity:reply", {
            username,
            data: reply,
        });
        await updateActivity(username, "reply", reply);
        await r.updateRedisFields(`watch-reply:${username}`, {
            eventAt: eventAt.toISOString(),
            jobId,
        });
        console.log(`✅ New reply found for ${username}`);
        return reply;
    }
}, {
    connection: redisConnectionOptions,
});
worker.on("ready", () => {
    console.log("🟢 replyQueue worker ready");
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
