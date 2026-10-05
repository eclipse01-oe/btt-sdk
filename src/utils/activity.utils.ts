import { UserActivity } from "../model/activity.model";
export const saveActivity = async (username: string, type: "post" | "reply", data: any, jobId: string) => UserActivity.findOneAndUpdate({
    username,
    type,
}, {
    $set: {
        username,
        type,
        title: data.title,
        link: data.link,
        board: data.board,
        rawEventAt: data.rawEventAt,
        eventAt: data.eventAt,
        jobId,
    },
}, {
    new: true,
    upsert: true,
});
export const updateActivity = async (username: string, type: "post" | "reply", data: any) => UserActivity.findOneAndUpdate({
    username,
    type,
}, {
    $set: {
        title: data.title,
        link: data.link,
        board: data.board,
        rawEventAt: data.rawEventAt,
        eventAt: data.eventAt,
    },
}, {
    new: true,
    upsert: true,
});
export const getActivity = async (username: string, type: "post" | "reply") => UserActivity.findOne({ username, type }).sort({ eventAt: -1 });
export const deleteActivity = async (username: string) => UserActivity.deleteMany({ username });
