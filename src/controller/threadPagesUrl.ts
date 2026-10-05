import { scraperHandler } from "../config/asyncHandler";
import { Request } from "../utils/url.utils";
import { processInBatches } from "../utils/batchSrapper";
import * as cheerio from "cheerio";
import * as err from "../utils/error.utils";
interface ThreadPage {
    pageNo: string;
    url: string;
}
const PAGE_SIZE = 20;
const getCurrentPageNo = (url: string): string => {
    const match = url.match(/topic=\d+\.(\d+)/);
    if (!match)
        return "1";
    const offset = Number(match[1]);
    return String(Math.floor(offset / PAGE_SIZE) + 1);
};
export const threadPages = (req: Request, url: string) => scraperHandler(async () => {
    console.log("thread url:", url);
    const page = await req.get(url, {
        authenticated: false,
    });
    const $ = cheerio.load(String(page.data));
    const seen = new Set<string>();
    const threadPageUrls: ThreadPage[] = [];
    $("td.middletext a.navPages").each((_, el) => {
        const href = $(el).attr("href");
        if (!href)
            return;
        const pageNo = $(el).text().trim().replace(/\[|\]/g, "");
        if (pageNo === "All")
            return;
        if (pageNo === "»" || pageNo === "«")
            return;
        if (seen.has(pageNo))
            return;
        seen.add(pageNo);
        threadPageUrls.push({ pageNo, url: href });
    });
    const currentPageNo = getCurrentPageNo(url);
    if (!seen.has(currentPageNo)) {
        threadPageUrls.push({ pageNo: currentPageNo, url });
    }
    return threadPageUrls;
});
export const getOriginalPoster = (req: Request, url: string) => scraperHandler(async () => {
    const opUrl = url.replace(/(topic=\d+\.)\d+/, "$10");
    console.log("OP url:", opUrl);
    const response = await req.get(opUrl, {
        authenticated: false,
    });
    const $ = cheerio.load(String(response.data));
    const firstPost = $(".windowbg, .windowbg2").first();
    if (!firstPost.length) {
        throw new err.err404("Original post not found");
    }
    const author = firstPost.find(".poster_info b a").text().trim();
    if (!author) {
        throw new err.err404("Original poster author not found");
    }
    return { author, url: opUrl };
});
interface ThreadReply {
    author: string;
    text: string;
    pageUrl: string;
    isOP: boolean;
    isOriginalPost: boolean;
}
export const scanLast20Pages = (req: Request, pages: ThreadPage[]) => scraperHandler(async () => {
    const sortedPages = [...pages].sort((a, b) => Number(a.pageNo) - Number(b.pageNo));
    const last20Pages = sortedPages.slice(-20);
    const opPage = sortedPages.find((p) => p.pageNo === "1");
    const pagesToScan = opPage && !last20Pages.some((p) => p.pageNo === "1") ? [opPage, ...last20Pages] : last20Pages;
    console.log(`🔍 Scanning ${pagesToScan.length} thread pages`);
    const replies: Omit<ThreadReply, "isOP" | "isOriginalPost">[] = [];
    let opAuthor: string | null = null;
    let opText: string | null = null; // ← new
    await processInBatches(pagesToScan, 5, async (page) => {
        console.log(`📄 Loading page ${page.pageNo}: ${page.url}`);
        const response = await req.get(page.url, {
            authenticated: false,
        });
        const $ = cheerio.load(String(response.data));
        const posts = $("form#quickModForm td.windowbg, form#quickModForm td.windowbg2");
        posts.each((i, post) => {
            const postElement = $(post);
            const author = postElement.find(".poster_info b a").text().trim();
            if (!author)
                return;
            postElement.find(".signature").remove();
            const message = postElement.find(".post").first();
            if (!message.length)
                return;
            message.find(".quote").remove();
            message.find(".quoteheader").remove();
            const text = message.text().replace(/\s+/g, " ").trim();
            if (!text)
                return;
            if (page.pageNo === "1" && i === 0) {
                opAuthor = author;
                opText = text;
            }
            replies.push({
                author,
                text,
                pageUrl: page.url,
            });
        });
    });
    return replies.map((reply) => ({
        ...reply,
        isOP: opAuthor !== null && reply.author === opAuthor,
        isOriginalPost: opText !== null && reply.text === opText,
    }));
});
export const getThreadReplies = (req: Request, url: string) => scraperHandler(async () => {
    const pages: ThreadPage[] = await threadPages(req, url);
    console.log({ pages });
    if (!pages.length) {
        console.log("🔍 No thread pages found, scanning the main page");
        const replies = await scanLast20Pages(req, [{ pageNo: "1", url }]);
        return replies;
    }
    const replies = await scanLast20Pages(req, pages);
    console.log(`🔍 Found ${replies.length} replies in the last 20 pages`);
    return replies;
});
