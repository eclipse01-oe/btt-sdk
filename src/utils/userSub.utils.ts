import type { Queue } from "bullmq";
import { UserSubscription } from "../model/userSub.model";
export type UserSubscriptionType = "post" | "reply" | "merit-sent" | "merit-received";
export const addUserSubscriber = async (username: string, subscriber: string, type: UserSubscriptionType, jobId: string) => UserSubscription.findOneAndUpdate({ username, subscriber, type }, { $set: { username, subscriber, type, jobId } }, { new: true, upsert: true });
export const removeUserSubscriber = async (username: string, subscriber: string, type: UserSubscriptionType) => UserSubscription.deleteOne({ username, subscriber, type });
export const getUserSubscriberCount = async (username: string, type: UserSubscriptionType) => UserSubscription.countDocuments({ username, type });
export const subscribeToUserJob = async (queue: Queue, username: string, subscriber: string, type: UserSubscriptionType, jobId: string, interval: number, name: string, data: Record<string, any>) => {
    await addUserSubscriber(username, subscriber, type, jobId);
    const subscriberCount = await getUserSubscriberCount(username, type);
    if (subscriberCount === 1) {
        await queue.upsertJobScheduler(jobId, { every: interval }, { name, data });
    }
    return { username, subscriber, type, jobId, subscriberCount };
};
export const unsubscribeFromUserJob = async (queue: Queue, username: string, subscriber: string, type: UserSubscriptionType, jobId: string) => {
    await removeUserSubscriber(username, subscriber, type);
    const subscriberCount = await getUserSubscriberCount(username, type);
    if (subscriberCount === 0) {
        await queue.removeJobScheduler(jobId);
    }
    return { username, subscriber, type, jobId, subscriberCount, hasSubscribers: subscriberCount > 0 };
};
