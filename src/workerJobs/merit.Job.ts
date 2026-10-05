import { WorkerJobHandler } from "../config/asyncHandler";
import { sentMeritQueue, receivedMeritQueue } from "../config/bullMQ";
import { meritPage } from "../controller/userUrl.controller";
import { callMerits } from "../scrappers/userScrappers/merit.scrapper";
import { Request } from "../utils/url.utils";
import * as meritDb from "../utils/merit.utils";
import * as err from "../utils/error.utils";
import { getUserSubscriberCount, subscribeToUserJob, unsubscribeFromUserJob, } from "../utils/userSub.utils";
const MERIT_WATCH_INTERVAL = 30000;
export const watchMerit = (username: string, subscriber: string, req: Request) => WorkerJobHandler(async () => {
    const sentJobId = `watchSentMerit-${username}`;
    const receivedJobId = `watchReceivedMerit-${username}`;
    const sentSubscriberCount = await getUserSubscriberCount(username, "merit-sent");
    const receivedSubscriberCount = await getUserSubscriberCount(username, "merit-received");
    if (sentSubscriberCount === 0 || receivedSubscriberCount === 0) {
        const meritsPage = err.nullCheck(await meritPage(username, req), "⚠️ Merit page not found");
        const merit = err.nullCheck(await callMerits(req, meritsPage), "⚠️ Merit data not found");
        if (sentSubscriberCount === 0 && merit.sent?.eventAt) {
            await meritDb.saveMerit(username, "sent", merit.sent, sentJobId);
        }
        if (receivedSubscriberCount === 0 && merit.received?.eventAt) {
            await meritDb.saveMerit(username, "received", merit.received, receivedJobId);
        }
    }
    const sentSubscription = await subscribeToUserJob(sentMeritQueue, username, subscriber, "merit-sent", sentJobId, MERIT_WATCH_INTERVAL, "watch-sent-merit", {
        username,
        jobId: sentJobId,
    });
    const receivedSubscription = await subscribeToUserJob(receivedMeritQueue, username, subscriber, "merit-received", receivedJobId, MERIT_WATCH_INTERVAL, "watch-received-merit", {
        username,
        jobId: receivedJobId,
    });
    console.log(`✅ Merit watcher created for ${username}`);
    return {
        sentJobId,
        receivedJobId,
        sentSubscriberCount: sentSubscription.subscriberCount,
        receivedSubscriberCount: receivedSubscription.subscriberCount,
    };
});
export const delWatchMerit = (username: string, subscriber: string) => WorkerJobHandler(async () => {
    const sentJobId = `watchSentMerit-${username}`;
    const receivedJobId = `watchReceivedMerit-${username}`;
    const sentSubscription = await unsubscribeFromUserJob(sentMeritQueue, username, subscriber, "merit-sent", sentJobId);
    const receivedSubscription = await unsubscribeFromUserJob(receivedMeritQueue, username, subscriber, "merit-received", receivedJobId);
    if (!sentSubscription.hasSubscribers) {
        await meritDb.deleteMerit(username, "sent");
    }
    if (!receivedSubscription.hasSubscribers) {
        await meritDb.deleteMerit(username, "received");
    }
    return {
        username,
        subscriber,
        sentSubscriberCount: sentSubscription.subscriberCount,
        receivedSubscriberCount: receivedSubscription.subscriberCount,
    };
});
