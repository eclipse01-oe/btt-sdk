import { BoardSpamCheck, UserSpamCheck } from "../model/spam.model";
import { type BoardActivity, type BoardActivitySpamResult, type SpamActivity, type UserActivitySpamResult, } from "./spamInterface.utils";
import type { SpamCheckResult } from "./spamInterface.utils";
import * as r from "../config/redis";
const boardSpamKey = (board: string) => `boardSpam:${board}`;
const userSpamKey = (username: string, activityLink: string) => `userSpam:${username}:${encodeURIComponent(activityLink)}`;
export const saveBoardSpam = async (board: string, activity: BoardActivity, targetText: string, result: SpamCheckResult) => {
    const response: BoardActivitySpamResult = {
        activity,
        targetText,
        result,
    };
    await BoardSpamCheck.findOneAndUpdate({
        board,
        postId: activity.postId,
    }, {
        $set: {
            board,
            postId: activity.postId,
            activity,
            targetText,
            result,
            spamScore: result.spamScore,
            risk: result.risk,
            offTopic: result.offTopic,
        },
    }, {
        upsert: true,
        new: true,
    });
    await r.setRedis(boardSpamKey(board), {
        postId: activity.postId,
        data: JSON.stringify(response),
    });
    return response;
};
export const getBoardSpam = async (board: string, postId: string): Promise<BoardActivitySpamResult | null> => {
    const redisData = await r.getAllRedis(boardSpamKey(board));
    if (redisData && redisData.postId === postId && redisData.data) {
        try {
            return JSON.parse(redisData.data) as BoardActivitySpamResult;
        }
        catch {
            await r.deleteRedis(boardSpamKey(board));
        }
    }
    const dbData = await BoardSpamCheck.findOne({
        board,
        postId,
    }).lean();
    if (!dbData) {
        return null;
    }
    const response: BoardActivitySpamResult = {
        activity: dbData.activity as BoardActivity,
        targetText: dbData.targetText,
        result: dbData.result as SpamCheckResult,
    };
    await r.setRedis(boardSpamKey(board), {
        postId: dbData.postId,
        data: JSON.stringify(response),
    });
    return response;
};
export const deleteBoardSpam = async (board: string) => {
    await BoardSpamCheck.deleteMany({
        board,
    });
    await r.deleteRedis(boardSpamKey(board));
};
export const saveUserSpam = async (username: string, activity: SpamActivity, targetText: string, result: SpamCheckResult) => {
    const response: UserActivitySpamResult = {
        activity,
        targetText,
        result,
    };
    const activityLink = activity.link;
    if (!activityLink) {
        return null;
    }
    await UserSpamCheck.findOneAndUpdate({
        username,
        type: activity.type,
        activityLink,
    }, {
        $set: {
            username,
            type: activity.type,
            activityLink,
            activity,
            targetText,
            result,
            spamScore: result.spamScore,
            risk: result.risk,
            offTopic: result.offTopic,
        },
    }, {
        upsert: true,
        new: true,
    });
    await r.setRedis(userSpamKey(username, activityLink), {
        data: JSON.stringify(response),
    });
    return response;
};
export const getUserSpam = async (username: string, type: "post" | "reply", activityLink: string): Promise<UserActivitySpamResult | null> => {
    const key = userSpamKey(username, activityLink);
    const redisData = await r.getRedisField(key, "data");
    if (redisData) {
        try {
            return JSON.parse(redisData) as UserActivitySpamResult;
        }
        catch {
            await r.deleteRedis(key);
        }
    }
    const dbData = await UserSpamCheck.findOne({
        username,
        type,
        activityLink,
    }).lean();
    if (!dbData) {
        return null;
    }
    const response: UserActivitySpamResult = {
        activity: dbData.activity as SpamActivity,
        targetText: dbData.targetText,
        result: dbData.result as SpamCheckResult,
    };
    await r.setRedis(key, {
        data: JSON.stringify(response),
    });
    return response;
};
export const deleteUserSpam = async (username: string) => {
    await UserSpamCheck.deleteMany({
        username,
    });
    const keys = await r.getKeys(`userSpam:${username}:*`);
    if (keys) {
        await Promise.all(keys.map((key) => r.deleteRedis(key)));
    }
};
