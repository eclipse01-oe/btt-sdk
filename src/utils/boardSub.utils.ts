import crypto from "node:crypto";
import type { Queue } from "bullmq";
import { BoardSubscription } from "../model/boardSub.model";
import {
    addRedisUser,
    deleteRedisSet,
    redis,
    removeRedisUser,
} from "../config/redis";

const BOARD_LOCK_TTL = 60_000;
const BOARD_LOCK_RETRY_MS = 100;
const BOARD_LOCK_MAX_WAIT_MS = 10_000;

export const boardSubscriberSetKey = (board: string) =>
    `btt:board:subscribers:${board.trim().toLowerCase()}`;

const boardLockKey = (board: string) =>
    `btt:lock:board:${board.trim().toLowerCase()}`;

const releaseLockScript = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
end
return 0
`;

const renewLockScript = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("pexpire", KEYS[1], ARGV[2])
end
return 0
`;


const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


const acquireBoardLock = async (board: string) => {
    const key = boardLockKey(board);
    const token = crypto.randomUUID();
    const deadline = Date.now() + BOARD_LOCK_MAX_WAIT_MS;

    while (Date.now() < deadline) {
        const acquired = await redis.set(key, token, "PX", BOARD_LOCK_TTL, "NX");
        if (acquired === "OK") {
            return { key, token };
        }

        await sleep(BOARD_LOCK_RETRY_MS);
    }

    throw new Error(`Timed out waiting for board subscription lock: ${board}`);
};


const releaseBoardLock = async (key: string, token: string) => {
    await redis.eval(releaseLockScript, 1, key, token);
};


export const withBoardSubscriptionLock = async <T>(
    board: string,
    fn: () => Promise<T>,
): Promise<T> => {
    const lock = await acquireBoardLock(board);
    const renewTimer = setInterval(() => {
        void redis.eval(
            renewLockScript,
            1,
            lock.key,
            lock.token,
            String(BOARD_LOCK_TTL),
        ).catch((error) => {
            console.error(`[BoardLock] Failed to renew ${board}:`, error);
        });
    }, Math.floor(BOARD_LOCK_TTL / 3));

    try {
        return await fn();
    } finally {
        clearInterval(renewTimer);
        await releaseBoardLock(lock.key, lock.token);
    }
};

export const addBoardSubscriber = async (
    board: string,
    username: string,
    jobId: string,
) =>
    BoardSubscription.findOneAndUpdate(
        { board, username },
        { $set: { board, username, jobId } },
        { new: true, upsert: true },
    );

export const removeBoardSubscriber = async (board: string, username: string) =>
    BoardSubscription.deleteOne({ board, username });

export const getBoardSubscriberCount = async (board: string) =>
    BoardSubscription.countDocuments({ board });

export const getBoardSubscribers = async (board: string) =>
    BoardSubscription.find({ board }).select({ username: 1, _id: 0 }).lean();

export const subscribeToJob = async <T>(
    queue: Queue,
    board: string,
    subscriber: string,
    jobId: string,
    interval: number,
    name: string,
    data: Record<string, any>,
    initialize?: () => Promise<T>,
) =>
    withBoardSubscriptionLock(board, async () => {
        const existingSubscription = await BoardSubscription.findOne({
            board,
            username: subscriber,
        }).lean();
        const existingSubscriberCount = await getBoardSubscriberCount(board);

        let initialData: T | undefined;

        if (existingSubscriberCount === 0 && initialize) {
            initialData = await initialize();
        }

        await addBoardSubscriber(board, subscriber, jobId);

        try {
            await addRedisUser(boardSubscriberSetKey(board), subscriber);

            await queue.upsertJobScheduler(jobId, { every: interval }, { name, data });

        } catch (error) {
            await Promise.allSettled([
                removeBoardSubscriber(board, subscriber),
                removeRedisUser(boardSubscriberSetKey(board), subscriber),
            ]);
            throw error;
        }

        const subscriberCount = await getBoardSubscriberCount(board);

        return {
            board,
            jobId,
            subscriber,
            subscriberCount,
            isNewSubscription: !existingSubscription,
            initialData,
        };
    });

export const unsubscribeFromJob = async (
    queue: Queue,
    board: string,
    subscriber: string,
    jobId: string,
) =>
    withBoardSubscriptionLock(board, async () => {
        await removeBoardSubscriber(board, subscriber);

        const subscriberCount = await getBoardSubscriberCount(board);

        if (subscriberCount === 0) {
            await queue.removeJobScheduler(jobId);
            await deleteRedisSet(boardSubscriberSetKey(board));
        } else {
            const remainingSubscribers = await getBoardSubscribers(board);
            const setKey = boardSubscriberSetKey(board);
            await deleteRedisSet(setKey);
            if (remainingSubscribers.length) {
                await redis.sadd(setKey, ...remainingSubscribers.map((remaining) => remaining.username));
            }
        }

        return {
            board,
            jobId,
            subscriber,
            subscriberCount,
            hasSubscribers: subscriberCount > 0,
        };
    });
