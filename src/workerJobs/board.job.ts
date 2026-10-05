import { newBoardPost, deleteBoard } from "../scrappers/boardScrapper/boardPost.scrapper";
import { WorkerJobHandler } from "../config/asyncHandler";
import { boardQueue } from "../config/bullMQ";
import { Request } from "../utils/url.utils";
import { getThreadReplies, findActivityTarget } from "../utils/spamactivity.utils";
import { type BoardActivity } from "../utils/spamInterface.utils";
import { SpamChecker } from "../services/spamChecker.services";
import * as err from "../utils/error.utils";
import { getBoardSpam, saveBoardSpam, deleteBoardSpam } from "../utils/spam.utils";
import { getBoardActivity, saveBoardActivity } from "../utils/board.utils";
import { subscribeToJob, unsubscribeFromJob } from "../utils/boardSub.utils";

const BOARD_WATCH_INTERVAL = 5000;
const THREAD_PAGE_BATCH_SIZE = 3;

export const watchBoard = (req: Request, board: string, username: string) =>
    WorkerJobHandler(async () => {
        const watchBoardJobId = `watchBoard-${board}`;

        const subscription = await subscribeToJob(
            boardQueue,
            board,
            username,
            watchBoardJobId,
            BOARD_WATCH_INTERVAL,
            "watch-board",
            { board, jobId: watchBoardJobId },
            async () => {
                const activity = err.nullCheck(
                    await newBoardPost(req, board),
                    `No activity found for ${board}`,
                );

                const boardActivity: BoardActivity = {
                    ...activity,
                    cat: activity.cat === "main" || activity.cat === "child" ? activity.cat : "main",
                };
                await saveBoardActivity(boardActivity);
                return boardActivity;
            },
        );

        const currentActivity = subscription.initialData ?? await getBoardActivity(board);

        return {
            ...(currentActivity ?? {}),
            board,
            watchBoardJobId,
            subscriber: username,
            subscriberCount: subscription.subscriberCount,
        };
    });

export const deleteWatchBoard = (board: string, username: string) =>
    WorkerJobHandler(async () => {
        const watchBoardJobId = `watchBoard-${board}`;
        const subscription = await unsubscribeFromJob(
            boardQueue,
            board,
            username,
            watchBoardJobId,
        );

        if (!subscription.hasSubscribers) {
            await deleteBoard(board);
            await deleteBoardSpam(board);
        }

        return {
            message: `No longer watching ${board} board`,
            subscriberCount: subscription.subscriberCount,
        };
    });

export const checkBoardActivityForSpam = (
    req: Request,
    activity: BoardActivity,
    spamChecker: SpamChecker,
) =>
    WorkerJobHandler(async () => {
        if (!activity.postLink)
            return null;

        const cached = await getBoardSpam(activity.name, activity.postId);
        if (cached) {
            console.log(`⚡ Spam cache hit for ${activity.postLink}`);
            return cached;
        }

        const replies = await getThreadReplies(req, activity.postLink, THREAD_PAGE_BATCH_SIZE);
        if (!replies.length)
            return null;

        const target = err.nullCheck(
            findActivityTarget(replies, activity.postLink, activity.poster),
            `⚠️ Target activity not found in ${activity.postLink}`,
        );

        const result = await spamChecker.checkSpam({
            targetText: target.text,
            replies,
            username: activity.poster,
        });

        return saveBoardSpam(activity.name, activity, target.text, result);
    });
