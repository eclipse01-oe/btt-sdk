import { Worker } from "bullmq";
import { redisConnectionOptions } from "../../config/redis";
import { callMerits } from "../../scrappers/userScrappers/merit.scrapper";
import { meritPage } from "../../controller/userUrl.controller";
import { getMerit, updateMerit } from "../../utils/merit.utils";
import { eventBus } from "../../event/eventBus";
import { getReq } from "../../services/req.services";
import * as r from "../../config/redis";
import * as err from "../../utils/error.utils";
const worker = new Worker("receivedMeritQueue", async (job) => {
    const { username, jobId } = job.data;
    const meritsPage = err.nullCheck(await meritPage(username, getReq()), "⚠️ Merit page not found");
    const merit = err.nullCheck(await callMerits(getReq(), meritsPage), "⚠️ Failed to scrape merit data");
    const meritData = merit.received;
    if (!meritData) {
        console.log(`ℹ️ ${username} has no received merit`);
        return;
    }
    const eventAt = err.nullCheck(meritData.eventAt, `⚠️ Received merit missing eventAt for ${username}`);
    const dbMerit = await getMerit(username, "received");
    const redisMerit = await r.getRedisField(`watch-received-merit:${username}`, "eventAt");
    const storedMerit = redisMerit || dbMerit?.eventAt;
    if (!storedMerit) {
        await r.setRedis(`watch-received-merit:${username}`, {
            eventAt: eventAt.toISOString(),
            jobId,
        });
        return;
    }
    const current = new Date(eventAt).getTime();
    const previous = new Date(storedMerit as Date).getTime();
    console.log("after emit merit:received listener count: ", eventBus.listenerCount("merit:received"));
    console.log("after emit");
    if (current > previous) {
        eventBus.emit("merit:received", {
            username,
            data: meritData,
        });
        await updateMerit(username, "received", meritData);
        await r.updateRedisFields(`watch-received-merit:${username}`, {
            eventAt: eventAt.toISOString(),
            jobId,
        });
        console.log(`✅ New received merit found for ${username}`);
        return meritData;
    }
}, {
    connection: redisConnectionOptions,
    concurrency: 5,
});
worker.on("ready", () => {
    console.log("🟢 receivedMeritQueue worker ready");
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
