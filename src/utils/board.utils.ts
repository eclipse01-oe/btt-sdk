import { BoardReg } from "../model/boardsReg.model";
import { Board } from "../model/boards.model";
import * as r from "../config/redis";
import type { BoardActivity } from "./spamInterface.utils";

export const checkBoardCat = async (boardName: string) => {
    const redisCat = await r.getMultipleRedisField(`board:${boardName.toLowerCase()}`, [
        "cat",
        "parentBoard",
        "parentUrl",
    ]);

    if (redisCat) {
        const [cat, parentBoard, parentUrl] = redisCat;
        return { cat, parentBoard, parentUrl };
    }

    console.log("failed to use redis, checking db");
    const dbCat = await BoardReg.findOne({ name: boardName.toLowerCase() });
    if (dbCat) {
        return { cat: "main" };
    }

    console.log("failed to use main db, checking child db");
    const childDbCat = await BoardReg.findOne({ "children.childBoardName": boardName.toLowerCase() });
    if (childDbCat) {
        return { cat: "child", parentUrl: childDbCat.url, parentBoard: childDbCat.name };
    }

    console.log("no such board, check the board name");
    return null;
};

export const parseDate = (text: string) => {
    if (!text)
        throw new Error("parseDate received undefined");

    if (text.startsWith("Today at ")) {
        const today = new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
        return new Date(`${today}, ${text.replace("Today at ", "")}`);
    }

    if (text.startsWith("Yesterday at ")) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const date = yesterday.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
        return new Date(`${date}, ${text.replace("Yesterday at ", "")}`);
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime()))
        throw new Error(`Unable to parse board date: ${text}`);

    return parsed;
};

export const saveBoardActivity = async (activity: BoardActivity) => {
    await Board.updateOne(
        { name: activity.name },
        {
            $set: {
                name: activity.name,
                url: activity.postLink,
                cat: activity.cat,
                postId: activity.postId,
                post: activity.post,
                poster: activity.poster,
                posterLink: activity.posterLink,
                rawDateTime: activity.rawDateTime,
                eventAt: activity.eventAt,
            },
        },
        { upsert: true },
    );

    await r.setRedis(`boardActivity:${activity.name}`, {
        name: activity.name,
        cat: activity.cat,
        postId: activity.postId,
        post: activity.post,
        postLink: activity.postLink,
        poster: activity.poster,
        posterLink: activity.posterLink,
        rawDateTime: activity.rawDateTime,
        eventAt: activity.eventAt.toISOString(),
    });

    return activity;
};

export const getBoardActivity = async (board: string): Promise<BoardActivity | null> => {
    const redisActivity = await r.getAllRedis(`boardActivity:${board}`);
    if (redisActivity?.postId) {
        return {
            name: redisActivity.name,
            cat: redisActivity.cat as BoardActivity["cat"],
            postId: redisActivity.postId,
            post: redisActivity.post,
            postLink: redisActivity.postLink,
            poster: redisActivity.poster,
            posterLink: redisActivity.posterLink,
            rawDateTime: redisActivity.rawDateTime,
            eventAt: new Date(redisActivity.eventAt),
        };
    }

    const dbActivity = await Board.findOne({ name: board }).lean();
    if (!dbActivity)
        return null;

    if (!dbActivity.eventAt) {
        return null;
    }

    const activity: BoardActivity = {
        name: dbActivity.name,
        cat: dbActivity.cat as BoardActivity["cat"],
        postId: dbActivity.postId,
        post: dbActivity.post ?? undefined,
        postLink: dbActivity.url,
        poster: dbActivity.poster ?? "",
        posterLink: dbActivity.posterLink ?? undefined,
        rawDateTime: dbActivity.rawDateTime ?? "",
        eventAt: dbActivity.eventAt,
    };

    await r.setRedis(`boardActivity:${board}`, activity);
    return activity;
};
