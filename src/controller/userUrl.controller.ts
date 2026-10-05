import { env } from "../config/zod";
import { scraperHandler } from "../config/asyncHandler";
import { ProfileUrl } from "../utils/url.utils";
import { Request } from "../utils/url.utils";
import * as cheerio from "cheerio";
export const meritPage = (username: string, req: Request) => scraperHandler(async () => {
    const url = ProfileUrl(username);
    console.log("user url: ", url);
    const page = await req.get(url);
    const $ = cheerio.load(String(page.data));
    const getMeritPage = $('a[href*="action=merit;"]').attr("href");
    const meritPage = getMeritPage ? `${env.BASE_URL}${getMeritPage}` : null;
    return meritPage;
});
export const activityPage = (username: string, req: Request) => scraperHandler(async () => {
    const url = ProfileUrl(username);
    console.log("user url:", url);
    const page = await req.get(url);
    const $ = cheerio.load(String(page.data));
    const repliesPage = $('a[href*="sa=showPosts"]').not('[href*="threads"]').attr("href") || null;
    const postsPage = $('a[href*="threads"][href*="showPosts"]').attr("href") || null;
    return { postsPage, repliesPage };
});
