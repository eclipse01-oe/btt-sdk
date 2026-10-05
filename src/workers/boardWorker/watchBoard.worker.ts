import { Worker } from "bullmq";
import { redisConnectionOptions } from "../../config/redis";
import { getReq } from "../../services/req.services";
import { newBoardPost } from "../../scrappers/boardScrapper/boardPost.scrapper";
import { boardSpamQueue } from "../../config/bullMQ";
import { getBoardActivity, saveBoardActivity } from "../../utils/board.utils";
import * as err from "../../utils/error.utils";
import { publishBoardEvent } from "../../event/boardEventHub";
import { BoardActivity } from "../../utils/spamInterface.utils";

const worker = new Worker(
    "boardQueue",
    async (job) => {
        const req = getReq();
        const { board } = job.data;
        const latestActivity = err.nullCheck(
            await newBoardPost(req, board),
            `No activity found for ${board}`,
        );

        const cat = latestActivity.cat

        if (cat !== "main" && cat !== "child") {
            throw new Error(`Invalid category for board activity in ${board}`);
        }

        const latest: BoardActivity = { ...latestActivity, cat }

        const cached = await getBoardActivity(board);
        if (cached?.postId === latestActivity.postId) {
            console.log(`No new activity in ${board}`);
            return;
        }

        await saveBoardActivity(latest);

        try {
            await publishBoardEvent("board:new", board, latest);
        } catch (error) {
            console.error(`❌ Failed to publish board event for ${board}`, error);
        }

        try {
            await boardSpamQueue.add(
                "check-board-spam",
                { board, activity: latestActivity },
                { jobId: `boardSpam-${board}-${latestActivity.postId}` },
            );
        } catch (error) {
            console.error(`❌ Failed to queue board spam check for ${board}`, error);
        }

        console.log(`📢 New activity detected in ${board}`);
        return latestActivity;
    },
    { connection: redisConnectionOptions },
);

worker.on("ready", () => console.log("🟢 boardQueue worker ready"));
worker.on("active", (job) => console.log(`▶ Job active: ${job.name}`));
worker.on("completed", (job) => console.log(`✅ Job completed: ${job.name}`));
worker.on("failed", (job, err) => {
    console.log(`❌ Job failed: ${job?.name}`);
    console.error(err);
});
