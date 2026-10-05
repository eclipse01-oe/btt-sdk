import { MeritData } from "../model/merit.model";
import * as r from "../config/redis";
const getMeritRedisKey = (username: string, type: "sent" | "received") => `watch-${type}-merit:${username}`;
const setMeritRedis = async (username: string, type: "sent" | "received", data: any, jobId?: string) => {
    const eventAt = data.eventAt instanceof Date
        ? data.eventAt.toISOString()
        : data.eventAt
            ? new Date(data.eventAt).toISOString()
            : null;
    await r.setRedis(getMeritRedisKey(username, type), {
        meritAmount: data.meritAmount,
        user: data.user,
        post: data.post,
        rawFullText: data.rawFullText,
        eventAt,
        rawEventAt: data.rawEventAt,
        ...(jobId ? { jobId } : {}),
    });
};
export const saveMerit = async (username: string, type: "sent" | "received", data: any, jobId: string) => {
    const merit = await MeritData.findOneAndUpdate({
        username,
        type,
    }, {
        $set: {
            username,
            type,
            meritAmount: data.meritAmount,
            user: data.user,
            post: data.post,
            rawFullText: data.rawFullText,
            eventAt: data.eventAt,
            rawEventAt: data.rawEventAt,
            jobId,
        },
    }, {
        new: true,
        upsert: true,
    });
    await setMeritRedis(username, type, data, jobId);
    return merit;
};
export const updateMerit = async (username: string, type: "sent" | "received", data: any) => {
    const result = await MeritData.findOneAndUpdate({
        username,
        type,
    }, {
        $set: {
            username,
            type,
            meritAmount: data.meritAmount,
            user: data.user,
            post: data.post,
            rawFullText: data.rawFullText,
            eventAt: data.eventAt,
            rawEventAt: data.rawEventAt,
        },
    }, {
        new: true,
        upsert: true,
    });
    const existingRedis = await r.getAllRedis(getMeritRedisKey(username, type));
    await setMeritRedis(username, type, data, existingRedis?.jobId);
    return result;
};
export const getMerit = async (username: string, type: "sent" | "received") => {
    const key = getMeritRedisKey(username, type);
    const redisMerit = await r.getAllRedis(key);
    if (redisMerit && redisMerit.eventAt) {
        return {
            username,
            type,
            meritAmount: redisMerit.meritAmount,
            user: redisMerit.user,
            post: redisMerit.post,
            rawFullText: redisMerit.rawFullText,
            eventAt: new Date(redisMerit.eventAt),
            rawEventAt: redisMerit.rawEventAt,
            jobId: redisMerit.jobId,
        };
    }
    const dbMerit = await MeritData.findOne({
        username,
        type,
    }).sort({ eventAt: -1 });
    if (!dbMerit) {
        return null;
    }
    await setMeritRedis(username, type, dbMerit, dbMerit.jobId ?? undefined);
    return dbMerit;
};
export const deleteMerit = async (username: string, type?: "sent" | "received") => {
    await MeritData.deleteMany({
        username,
        ...(type ? { type } : {}),
    });
    if (!type || type === "sent") {
        await r.deleteRedis(`watch-sent-merit:${username}`);
    }
    if (!type || type === "received") {
        await r.deleteRedis(`watch-received-merit:${username}`);
    }
};
