import { Worker } from "bullmq";
import { redisConnectionOptions } from "../../config/redis";
import { getReq } from "../../services/req.services";
import { SpamChecker } from "../../services/spamChecker.services";
import { checkBoardActivityForSpam } from "../../workerJobs/board.job";
import { publishBoardEvent } from "../../event/boardEventHub";
import { type BoardActivity } from "../../utils/spamInterface.utils";

const spamChecker = new SpamChecker();
const spamCheckerReady = spamChecker.init();

const worker = new Worker(
    "boardSpamQueue",
    async (job) => {
        await spamCheckerReady;

        const { board, activity: rawActivity } = job.data;
        const activity: BoardActivity = {
            ...rawActivity,
            eventAt: new Date(rawActivity.eventAt),
        };

        const result = await checkBoardActivityForSpam(getReq(), activity, spamChecker);
        if (!result) {
            return null;
        }

        try {
            await publishBoardEvent("board:spam", board, result);
        } catch (error) {
            console.error(`❌ Failed to publish board spam event for ${board}`, error);
        }

        console.log(`✅ Board spam result emitted for ${board}`);
        return result;
    },
    {
        connection: redisConnectionOptions,
        concurrency: 1,
    },
);

worker.on("ready", () => {
    console.log("🟢 boardSpamQueue worker ready");
});
worker.on("active", (job) => {
    console.log(`▶ Spam job active: ${job.name}`);
});
worker.on("completed", (job) => {
    console.log(`✅ Spam job completed: ${job.name}`);
});
worker.on("failed", (job, err) => {
    console.log(`❌ Spam job failed: ${job?.name}`);
    console.error(err);
});
