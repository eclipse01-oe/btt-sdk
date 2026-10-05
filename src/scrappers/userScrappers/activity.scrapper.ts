import * as cheerio from "cheerio";
import { scraperHandler } from "../../config/asyncHandler";
import * as err from "../../utils/error.utils";
import { Request } from "../../utils/url.utils";
const parseForumActivityDate = (rawCreatedAt: string | null): Date | null => {
    if (!rawCreatedAt) {
        return null;
    }
    if (/^today\s+at/i.test(rawCreatedAt)) {
        const time = rawCreatedAt.replace(/^today\s+at\s*/i, "");
        const today = new Date();
        return new Date(`${today.toDateString()} ${time}`);
    }
    if (/^yesterday\s+at/i.test(rawCreatedAt)) {
        const time = rawCreatedAt.replace(/^yesterday\s+at\s*/i, "");
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return new Date(`${yesterday.toDateString()} ${time}`);
    }
    const parsed = new Date(rawCreatedAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
// Activities data
export const getActivities = (url: string, req: Request, start = 0) => scraperHandler(async () => {
    const pageUrl = start === 0 ? url : `${url.replace(/[;&]start=\d+/i, "")};start=${start}`;
    const page = await req.get(pageUrl);
    const $ = cheerio.load(String(page.data));
    const items = $("tr .titlebg2 .middletext").toArray();
    if (!items.length) {
        return null;
    }
    const activities: string[] = [];
    for (let i = 0; i + 1 < items.length; i += 2) {
        const html = $(items[i]).html() ?? "";
        const time = $(items[i + 1]).html() ?? "";
        activities.push(`${html}, ${time}`);
    }
    return activities;
});
// Last posts made
export const postActivity = (data: string[]) => scraperHandler(async () => {
    const html = data[0] ?? "";
    if (!html.trim()) {
        return null;
    }
    const $ = cheerio.load(html);
    const root = $.root();
    const links = root
        .find("a")
        .map((_, a) => $(a).attr("href"))
        .get();
    const linksText = root
        .find("a")
        .map((_, a) => $(a).text().trim())
        .get();
    if (linksText[2]?.includes("Re:")) {
        console.log("reply in post fn");
        throw new err.err422("❌ Replies page can't get post");
    }
    const rawCreatedAt = root
        .text()
        .match(/on:\s*(.*)$/is)?.[1]
        ?.trim() ?? null;
    const eventAt = parseForumActivityDate(rawCreatedAt);
    return {
        type: "post",
        title: linksText[2] ?? null,
        link: links[2] ?? null,
        board: {
            name: linksText[1] ?? null,
            url: links[1] ?? null,
        },
        rawEventAt: rawCreatedAt,
        eventAt,
    };
});
// Last reply made
export const replyActivity = (data: string[]) => scraperHandler(async () => {
    const html = data[0] ?? "";
    if (!html.trim()) {
        return null;
    }
    const $ = cheerio.load(html);
    const root = $.root();
    const links = root
        .find("a")
        .map((_, a) => $(a).attr("href"))
        .get();
    const linksText = root
        .find("a")
        .map((_, a) => $(a).text().trim())
        .get();
    if (!linksText[2]?.includes("Re:")) {
        console.log("reply in post fn");
        throw new err.err422("❌ Post page can't get reply");
    }
    const rawCreatedAt = root
        .text()
        .match(/on:\s*(.*)$/is)?.[1]
        ?.trim() ?? null;
    const eventAt = parseForumActivityDate(rawCreatedAt);
    return {
        type: "reply",
        title: linksText[2] ?? null,
        link: links[2] ?? null,
        board: {
            name: linksText[1] ?? null,
            url: links[1] ?? null,
        },
        rawEventAt: rawCreatedAt,
        eventAt,
    };
});
export const callActivity = async (req: Request, url: string, activities: "post" | "reply") => {
    const html = await getActivities(url, req);
    if (!html) {
        return null;
    }
    if (activities === "post") {
        const post = await postActivity(html);
        return post;
    }
    if (activities === "reply") {
        const reply = await replyActivity(html);
        return reply;
    }
};
export const callFullActivity = async (req: Request, url: string, activities: "post" | "reply") => {
    const html = await getActivities(url, req);
    if (!html) {
        return null;
    }
    const activity: object[] = [];
    for (const item of html) {
        const data = activities === "post" ? await postActivity([item]) : await replyActivity([item]);
        if (data) {
            activity.push(data);
        }
    }
    return activity;
};
