import * as cheerio from "cheerio";
import type { SpamActivity, ThreadReply } from "./spamInterface.utils";
import { processInBatches } from "./batchSrapper";
import { Request } from "./url.utils";
// ============================================================
// ACTIVITY PAGINATION
// ============================================================
export const buildActivityPageStarts = (pageCount = 10): number[] => {
    return Array.from({ length: pageCount }, (_, index) => index * 20);
};
// ============================================================
// ACTIVITY HTML PARSER
// ============================================================
export const parseActivityHtml = (html: string): SpamActivity | null => {
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
    if (links.length < 3) {
        return null;
    }
    const title = linksText[2] ?? null;
    const type: "post" | "reply" = title?.startsWith("Re:") ? "reply" : "post";
    const rawEventAt = root
        .text()
        .match(/on:\s*(.*)$/is)?.[1]
        ?.trim() ?? null;
    const eventAt = parseForumActivityDate(rawEventAt);
    return {
        type,
        title,
        link: links[2] ?? null,
        board: {
            name: linksText[1] ?? null,
            url: links[1] ?? null,
        },
        rawEventAt,
        eventAt,
    };
};
const parseForumActivityDate = (rawEventAt: string | null): Date | null => {
    if (!rawEventAt) {
        return null;
    }
    if (/^today\s+at/i.test(rawEventAt)) {
        const time = rawEventAt.replace(/^today\s+at\s*/i, "");
        const today = new Date();
        return new Date(`${today.toDateString()} ${time}`);
    }
    if (/^yesterday\s+at/i.test(rawEventAt)) {
        const time = rawEventAt.replace(/^yesterday\s+at\s*/i, "");
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return new Date(`${yesterday.toDateString()} ${time}`);
    }
    const parsed = new Date(rawEventAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
// ============================================================
// MESSAGE ID
// ============================================================
export const extractMessageId = (url: string | null): string | null => {
    if (!url) {
        return null;
    }
    const match = url.match(/(?:\.msg|#msg)(\d+)/i);
    if (!match) {
        return null;
    }
    const messageId = match[1];
    if (messageId === "0") {
        return null;
    }
    return messageId;
};
// ============================================================
// TOPIC FIRST PAGE
// ============================================================
export const getTopicFirstPage = (url: string): string => {
    const topicId = url.match(/[?;&]topic=(\d+)/i)?.[1];
    if (!topicId) {
        return url;
    }
    const parsedUrl = new URL(url);
    return `${parsedUrl.origin}` + `/index.php?topic=${topicId}.0`;
};
// ============================================================
// POST TEXT
// ============================================================
const normalizePostText = (value: string): string => {
    return value
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};
const renderPostNode = ($: cheerio.CheerioAPI, node: any): string => {
    if (node.type === "text") {
        return node.data ?? "";
    }
    if (node.type !== "tag") {
        return "";
    }
    const tagName = String(node.name ?? "").toLowerCase();
    if (tagName === "script" || tagName === "style") {
        return "";
    }
    if (tagName === "br") {
        return "\n";
    }
    const className = $(node).attr("class") ?? "";
    const classes = className.split(/\s+/);
    if (classes.includes("quoteheader")) {
        return "";
    }
    const children = (node.children ?? []).map((child: any) => renderPostNode($, child)).join("");
    if (classes.includes("quote")) {
        return "\n[quote]\n" + normalizePostText(children) + "\n[/quote]\n";
    }
    return children;
};
const extractPostText = ($: cheerio.CheerioAPI, postNode: any): string => {
    if (!postNode) {
        return "";
    }
    const output = (postNode.children ?? []).map((child: any) => renderPostNode($, child)).join("");
    return normalizePostText(output);
};
// ============================================================
// THREAD REPLIES
// ============================================================
export const extractThreadReplies = (html: string, sourceUrl: string, firstPage: boolean): ThreadReply[] => {
    const $ = cheerio.load(html);
    const replies: ThreadReply[] = [];
    $("div.post").each((index, element) => {
        const post = $(element);
        const table = post.closest("table");
        const posterInfo = table.find(".poster_info").first();
        const author = posterInfo.find("b").first().text().trim();
        if (!author) {
            return;
        }
        const subject = table.find(".subject").first();
        const subjectLink = subject.find("a").first().attr("href");
        const messageLink = table.find('a[href*="#msg"]').first().attr("href");
        const rawPageUrl = subjectLink ?? messageLink ?? sourceUrl;
        const pageUrl = new URL(rawPageUrl, sourceUrl).href;
        const text = extractPostText($, element);
        if (!text) {
            return;
        }
        replies.push({
            author,
            text,
            pageUrl,
            isOP: false,
            isOriginalPost: firstPage && index === 0,
        });
    });
    const originalPost = replies.find((reply) => reply.isOriginalPost);
    const opUsername = originalPost?.author.toLowerCase() ?? null;
    return replies.map((reply) => ({
        ...reply,
        isOP: opUsername !== null && reply.author.toLowerCase() === opUsername,
    }));
};
// ============================================================
// MERGE THREAD REPLIES
// ============================================================
export const mergeThreadReplies = (firstPageReplies: ThreadReply[], activityPageReplies: ThreadReply[]): ThreadReply[] => {
    const merged = new Map<string, ThreadReply>();
    for (const reply of firstPageReplies) {
        const key = extractMessageId(reply.pageUrl) ?? reply.pageUrl;
        merged.set(key, reply);
    }
    for (const reply of activityPageReplies) {
        const key = extractMessageId(reply.pageUrl) ?? reply.pageUrl;
        const existing = merged.get(key);
        if (existing?.isOriginalPost) {
            continue;
        }
        merged.set(key, reply);
    }
    const replies = [...merged.values()];
    const originalPost = replies.find((reply) => reply.isOriginalPost);
    const opUsername = originalPost?.author.toLowerCase() ?? null;
    return replies.map((reply) => ({
        ...reply,
        isOP: opUsername !== null && reply.author.toLowerCase() === opUsername,
    }));
};
// ============================================================
// FETCH THREAD PAGES
// ============================================================
export const getThreadReplies = async (req: Request, activityLink: string, batchSize = 2): Promise<ThreadReply[]> => {
    const firstPageUrl = getTopicFirstPage(activityLink);
    const urls = [firstPageUrl, activityLink].filter((url, index, array) => array.indexOf(url) === index);
    const pages: Array<string | undefined> = new Array(urls.length);
    await processInBatches(urls.map((url, index) => ({
        url,
        index,
    })), batchSize, async ({ url, index }) => {
        const response = await req.get(url);
        pages[index] = String(response.data);
    });
    const firstPageIndex = urls.indexOf(firstPageUrl);
    const activityPageIndex = urls.indexOf(activityLink);
    const firstPageReplies = extractThreadReplies(pages[firstPageIndex] ?? "", firstPageUrl, true);
    const activityPageReplies = extractThreadReplies(pages[activityPageIndex] ?? "", activityLink, false);
    return mergeThreadReplies(firstPageReplies, activityPageReplies);
};
// ============================================================
// FIND THE TARGET ACTIVITY
// ============================================================
export const findActivityTarget = (replies: ThreadReply[], activityLink: string | null, username: string): ThreadReply | null => {
    const messageId = extractMessageId(activityLink);
    if (messageId) {
        const exact = replies.find((reply) => extractMessageId(reply.pageUrl) === messageId);
        if (exact) {
            return exact;
        }
    }
    const normalizedUsername = username.toLowerCase();
    for (let i = replies.length - 1; i >= 0; i--) {
        const reply = replies[i];
        if (reply.author.toLowerCase() === normalizedUsername) {
            return reply;
        }
    }
    return null;
};
