import { Worker } from "bullmq";
import { redisConnectionOptions } from "../../config/redis";
import { callMerits } from "../../scrappers/userScrappers/merit.scrapper";
import { meritPage } from "../../controller/userUrl.controller";
import { getMerit, updateMerit } from "../../utils/merit.utils";
import { eventBus } from "../../event/eventBus";
import { getReq } from "../../services/req.services";
import * as r from "../../config/redis";
import * as err from "../../utils/error.utils";
const worker = new Worker("sentMeritQueue", async (job) => {
    const { username, jobId } = job.data;
    console.log(`🔍 Checking sent merit for ${username}`);
    const meritsPage = err.nullCheck(await meritPage(username, getReq()), "⚠️ Merit page not found");
    const merit = err.nullCheck(await callMerits(getReq(), meritsPage), "⚠️ Failed to scrape merit data");
    const meritData = merit.sent;
    if (!meritData) {
        console.log(`ℹ️ ${username} has no sent merit`);
        return;
    }
    const eventAt = err.nullCheck(meritData.eventAt, `⚠️ Sent merit missing eventAt for ${username}`);
    const dbMerit = await getMerit(username, "sent");
    const redisMerit = await r.getRedisField(`watch-sent-merit:${username}`, "eventAt");
    const storedMerit = redisMerit || dbMerit?.eventAt;
    if (!storedMerit) {
        await r.setRedis(`watch-sent-merit:${username}`, {
            eventAt: eventAt.toISOString(),
            jobId,
        });
        return;
    }
    const current = new Date(eventAt).getTime();
    const previous = new Date(storedMerit as Date).getTime();
    if (current > previous) {
        eventBus.emit("merit:sent", {
            username,
            data: meritData,
        });
        await updateMerit(username, "sent", meritData);
        await r.updateRedisFields(`watch-sent-merit:${username}`, {
            eventAt: eventAt.toISOString(),
            jobId,
        });
        console.log(`✅ New sent merit found for ${username}`);
        return meritData;
    }
}, {
    connection: redisConnectionOptions,
    concurrency: 5,
});
worker.on("ready", () => {
    console.log("🟢 sentMeritQueue worker ready");
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
