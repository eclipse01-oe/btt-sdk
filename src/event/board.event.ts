import { scraperHandler } from "../config/asyncHandler";
import { Request } from "../utils/url.utils";
import { getAllBoards } from "../controller/boardUrl.controller";
import { BoardInit } from "../model/boardsReg.model";
import { watchBoard, deleteWatchBoard } from "../workerJobs/board.job";
export const getBoards = (req: Request) => scraperHandler(async () => {
    const init = await BoardInit.findOne({ task: "boards" });
    if (init?.status === "completed") {
        console.log("✅ Boards already initialized");
        return;
    }
    await getAllBoards(req);
    await BoardInit.updateOne({ task: "boards" }, {
        $set: {
            status: "completed",
            completedAt: new Date(),
        },
    }, { upsert: true });
});
export const WatchBoard = (req: Request, board: string, username: string) => scraperHandler(async () => {
    return watchBoard(req, board, username);
});
export const DelWatchBoard = (username: string, board: string) => scraperHandler(async () => {
    return deleteWatchBoard(board, username);
});
