import { WorkerJobHandler } from "../config/asyncHandler";
import { postQueue, replyQueue } from "../config/bullMQ";
import { activityPage } from "../controller/userUrl.controller";
import { callActivity } from "../scrappers/userScrappers/activity.scrapper";
import { deleteActivity, saveActivity } from "../utils/activity.utils";
import { getActivities } from "../scrappers/userScrappers/activity.scrapper";
import { Request } from "../utils/url.utils";
import { processInBatches } from "../utils/batchSrapper";
import { type SpamActivity, type UserActivitySpamResult } from "../utils/spamInterface.utils";
import { SpamChecker } from "../services/spamChecker.services";
import { getThreadReplies, findActivityTarget, parseActivityHtml, } from "../utils/spamactivity.utils";
import * as r from "../config/redis";
import * as err from "../utils/error.utils";
import { getUserSpam, saveUserSpam } from "../utils/spam.utils";
import { subscribeToUserJob, unsubscribeFromUserJob, getUserSubscriberCount, } 
from "../utils/userSub.utils";


export const watchActivity = (username: string, subscriber: string, req: Request) => 
    WorkerJobHandler(async () => {

    const postSubscriberCount = await getUserSubscriberCount(username, "post");

    const replySubscriberCount = await getUserSubscriberCount(username, "reply");

    if (postSubscriberCount === 0 || replySubscriberCount === 0) {
        const page = err.nullCheck(await activityPage(username, req), "⚠️ Activity page not found");

        if (postSubscriberCount === 0) {
            const postsPage = err.nullCheck(page.postsPage, "⚠️ Posts page not found");

            const post = await callActivity(req, postsPage, "post");
            const postJobId = `watchPost-${username}`;

            if (post?.eventAt) {
                await saveActivity(username, "post", post, postJobId);
                await r.setRedis(`watch-post:${username}`, {
                    eventAt: post.eventAt.toISOString(),
                    jobId: postJobId,
                });
            }
        }

        if (replySubscriberCount === 0) {
            const repliesPage = err.nullCheck(page.repliesPage, "⚠️ Replies page not found");
            const reply = await callActivity(req, repliesPage, "reply");
            const replyJobId = `watchReply-${username}`;
            if (reply?.eventAt) {
                await saveActivity(username, "reply", reply, replyJobId);
                await r.setRedis(`watch-reply:${username}`, {
                    eventAt: reply.eventAt.toISOString(),
                    jobId: replyJobId,
                });
            }
        }
    }

    const postJobId = `watchPost-${username}`;
    const replyJobId = `watchReply-${username}`;
    const postSubscription = await subscribeToUserJob(
        postQueue, 
        username, 
        subscriber, 
        "post", 
        postJobId, 
        30000, 
        "watch-post", 
        { username, jobId: postJobId }
    );

    const replySubscription = await subscribeToUserJob(
        replyQueue, 
        username, 
        subscriber, 
        "reply", 
        replyJobId, 
        30000, 
        "watch-reply", 
        { username, jobId: replyJobId }
    );

    console.log(`✅ Activity watcher created for ${username}`);

    return {
        postJobId,
        replyJobId,
        postSubscriberCount: postSubscription.subscriberCount,
        replySubscriberCount: replySubscription.subscriberCount,
    };
});



export const delWatchActivity = (username: string, subscriber: string) => 
    WorkerJobHandler(async () => {

    const postJobId = `watchPost-${username}`;
    const replyJobId = `watchReply-${username}`;

    const postSubscription = await unsubscribeFromUserJob(
        postQueue, 
        username, 
        subscriber, 
        "post", 
        postJobId

    );
    const replySubscription = await unsubscribeFromUserJob(
        replyQueue, 
        username, 
        subscriber, 
        "reply", 
        replyJobId

    );

    if (!postSubscription.hasSubscribers) {
        await r.deleteRedis(`watch-post:${username}`);
    }
    
    if (!replySubscription.hasSubscribers) {
        await r.deleteRedis(`watch-reply:${username}`);
    }

    if (!postSubscription.hasSubscribers && !replySubscription.hasSubscribers) {
        await deleteActivity(username);
    }

    return {
        username,
        subscriber,
        postSubscriberCount: postSubscription.subscriberCount,
        replySubscriberCount: replySubscription.subscriberCount,
    };
});


//Spam Activities

const ACTIVITY_PAGE_COUNT = 10;
const ACTIVITY_PAGE_BATCH_SIZE = 3;
const THREAD_PAGE_BATCH_SIZE = 3;
const SPAM_CHECK_BATCH_SIZE = 3;


export const getUserActivitiesForSpam = (req: Request, activityUrl: string) => 
    WorkerJobHandler(async () => {

    const starts = Array.from({ length: ACTIVITY_PAGE_COUNT,}, (_, index) => index * 20);
    const activities: SpamActivity[] = [];

    await processInBatches(starts, ACTIVITY_PAGE_BATCH_SIZE, async (start) => {

        const page = await getActivities(activityUrl, req, start);
        if (!page) {
            return;
        }
        for (const html of page) {
            const activity = parseActivityHtml(html);
            if (activity) {
                activities.push(activity);
            }
        }
    });

    return activities;
});



export const checkUserActivityForSpam = (
    req: Request, 
    activity: SpamActivity, 
    username: string, 
    spamChecker: SpamChecker) =>  WorkerJobHandler(async () => {

    const activityLink = err.nullCheck(activity.link, "⚠️ Activity link not found");
    const cached = await getUserSpam(username, activity.type, activityLink);

    if (cached) {
        console.log(`⚡ Spam cache hit for ${activityLink}`);
        return cached;
    }

    const replies = await getThreadReplies(req, activityLink, THREAD_PAGE_BATCH_SIZE);

    const validReplies = err.nullCheck(
        replies.length ? replies : null, 
        `⚠️ No thread replies found for ${activityLink}`
    );

    const target = err.nullCheck(
        findActivityTarget(validReplies, activityLink, username), 
        `⚠️ Target activity not found in ${activityLink}`
    );

    const result = await spamChecker.checkSpam({
        targetText: target.text,
        replies: validReplies,
        username,
    });

    return saveUserSpam(username, activity, target.text, result);
});



export const checkUserActivitiesForSpam = (
    req: Request, 
    activityUrl: string, 
    username: string, 
    spamChecker: SpamChecker) => WorkerJobHandler(async () => {

    const activities = await getUserActivitiesForSpam(req, activityUrl);
    const results: UserActivitySpamResult[] = [];

    await processInBatches(activities, SPAM_CHECK_BATCH_SIZE, async (activity) => {
        try {
            const result = await checkUserActivityForSpam(req, activity, username, spamChecker);
            if (result) {
                results.push(result);
            }
        }
        catch (error) {
            console.error(`❌ Failed to check user activity: ${activity.link}`, error);
        }
    });

    return results;
});


/* ============================================================
   USER SPAM QUEUE
   ============================================================ */


export const checkUserSpam = (
    req: Request, 
    username: string, 
    type: "post" | "reply", 
    spamChecker: SpamChecker) => WorkerJobHandler(async () => {

    const page = err.nullCheck(await activityPage(username, req), "⚠️ Activity page not found");

    const activityUrl = err.nullCheck(
        type === "post" ? page.postsPage : 
        page.repliesPage, type === "post" ? 
        "⚠️ Posts page not found" : "⚠️ Replies page not found"
    );

    return checkUserActivitiesForSpam(req, activityUrl, username, spamChecker);

});
