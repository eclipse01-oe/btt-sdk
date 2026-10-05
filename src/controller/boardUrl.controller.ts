import * as cheerio from "cheerio";
import { scraperHandler } from "../config/asyncHandler";
import { env } from "../config/zod";
import { BoardReg } from "../model/boardsReg.model";
import { processInBatches, getBoardAliases } from "../utils/batchSrapper";
import { Request } from "../utils/url.utils";
import * as r from "../config/redis";
interface BoardInfo {
    name: string;
    url: string;
    boardId: string;
}
export const getBoards = (req: Request) => scraperHandler(async () => {
    console.log("🔍 Looking up board URLs and names");
    const home = await req.get(env.BASE_URL, {
        authenticated: false,
    });
    const $ = cheerio.load(String(home.data));
    const board = $(".windowbg2")
        .filter((_, el) => $(el).find("table, span").length === 0)
        .toArray();
    const boards: BoardInfo[] = [];
    for (const d of board) {
        const name = $(d).find("b a").text().trim().toLowerCase();
        const url = $(d).find("b a").attr("href") ?? "";
        const boardId = url.match(/board=([\d.]+)/)?.[1] ?? "";
        boards.push({
            name,
            url,
            boardId,
        });
        const aliases = getBoardAliases(name);
        await BoardReg.updateOne({ boardId }, {
            $set: {
                name,
                url,
                aliases,
            },
        }, {
            upsert: true,
        });
        for (const alias of aliases) {
            await r.setRedis(`board:${alias}`, {
                alias,
                name,
                url,
                boardId,
                cat: "main",
            });
        }
    }
    return boards;
});
export const getAllBoards = (req: Request) => scraperHandler(async () => {
    console.log("🔍 Looking up child board URLs and names");
    const boards = await getBoards(req);
    const childBoards: BoardInfo[] = [];
    await processInBatches(boards, 5, async (b) => {
        const link = await req.get(b.url, {
            authenticated: false,
        });
        const $ = cheerio.load(String(link.data));
        const children = $("#bodyarea .windowbg2 b a").toArray();
        for (const d of children) {
            const childBoardName = $(d).text().trim().toLowerCase();
            const childBoardUrl = $(d).attr("href") ?? "";
            const childBoardId = childBoardUrl.match(/board=([\d.]+)/)?.[1] ?? "";
            childBoards.push({
                name: childBoardName,
                url: childBoardUrl,
                boardId: childBoardId,
            });
            await BoardReg.updateOne({ boardId: b.boardId }, {
                $addToSet: {
                    children: {
                        childBoardId,
                        childBoardUrl,
                        childBoardName,
                    },
                },
            }, {
                upsert: true,
            });
            await r.setRedis(`board:${childBoardName}`, {
                parentBoard: b.name,
                parentUrl: b.url,
                name: childBoardName,
                url: childBoardUrl,
                boardId: childBoardId,
                cat: "child",
            });
        }
    });
    return childBoards;
});
