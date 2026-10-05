import { watchActivity, delWatchActivity } from "../workerJobs/activity.job";
import { watchMerit, delWatchMerit } from "../workerJobs/merit.Job";
import { scraperHandler } from "../config/asyncHandler";
import { Request } from "../utils/url.utils";
import { getUser } from "../scrappers/userScrappers/userDAta.scrapper";
export const watchUser = (username: string, subscriber: string, req: Request) => scraperHandler(async () => {
    const user = await getUser(username, req);
    const [merit, activity] = await Promise.all([
        watchMerit(username, subscriber, req),
        watchActivity(username, subscriber, req),
    ]);
    return {
        user,
        merit,
        activity,
    };
});
export const delWatchUser = (username: string, subscriber: string) => scraperHandler(async () => {
    const [activity, merit] = await Promise.all([
        delWatchActivity(username, subscriber),
        delWatchMerit(username, subscriber),
    ]);
    return {
        activity,
        merit,
    };
});
