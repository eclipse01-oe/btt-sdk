import * as cheerio from "cheerio";
import { env } from "../../config/zod";
import { scraperHandler } from "../../config/asyncHandler";
import { Request } from "../../utils/url.utils";
import * as err from "../../utils/error.utils";
import { parseDate, checkBoardCat } from "../../utils/board.utils";


export const getNewBoardActivities = (req: Request, boardName: string) => {
    return scraperHandler(async () => {
        
        console.log("🔍 ....Looking up activity in board");
        const boardCat = err.nullCheck(await checkBoardCat(boardName), `${boardName} board not found`);
        const isMain = boardCat.cat === "main";
        const home = isMain
            ? await req.get(env.BASE_URL, { authenticated: false })
            : await req.get(err.nullCheck(boardCat.parentUrl, `${boardName} parentUrl not found`), {
                authenticated: false,
            });
        const $ = cheerio.load(String(home.data));
        const boards = isMain
            ? $("#bodyarea tr").has("td.windowbg2").toArray()
            : $("#bodyarea tr").has("small").toArray();
        for (const b of boards) {
            const name = $(b).find("b a").text().trim();
            if (name.toLowerCase() !== boardName.toLowerCase()) {
                continue;
            }
            const activityNodes = isMain
                ? $(b).find("span.smalltext").toArray()
                : $(b).find("small").toArray();
            for (const node of activityNodes) {
                const links = $(node).find("a").toArray();
                if (links.length < 2)
                    continue;
                const text = $(node).text();
                const dateTime = text.match(/((?:Today|Yesterday) at \d{1,2}:\d{2}:\d{2}\s(?:AM|PM))|([A-Za-z]+\s\d{1,2},\s\d{4},\s\d{1,2}:\d{2}:\d{2}\s(?:AM|PM))/)?.[0];
                if (!dateTime)
                    continue;
                const activity = {
                    name: boardName,
                    cat: boardCat.cat,
                    posterLink: $(links[0]).attr("href"),
                    poster: $(links[0]).text().trim(),
                    postLink: $(links[1]).attr("href"),
                    post: $(links[1]).attr("title"),
                    topicId: String($(links[1]).attr("href")).match(/topic=(\d+)/)?.[1],
                    rawDateTime: dateTime,
                    eventAt: parseDate(dateTime),
                    postId: "",
                };
                activity.postId = [
                    activity.topicId,
                    activity.poster,
                    activity.post,
                    activity.eventAt.toISOString(),
                ].join(":");
                return activity;
            }
        }
        return null;
    });
};
