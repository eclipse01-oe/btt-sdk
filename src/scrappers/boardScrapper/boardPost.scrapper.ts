import { scraperHandler } from "../../config/asyncHandler";
import { Request } from "../../utils/url.utils";
import { getNewBoardActivities } from "./board.scrapper";
import * as err from "../../utils/error.utils";
import { Board } from "../../model/boards.model";
export const newBoardPost = (req: Request, boardName: string) => scraperHandler(async () => {
    return err.nullCheck(await getNewBoardActivities(req, boardName), "🔍 board name not found");
});
export const deleteBoard = (board: string) => scraperHandler(async () => {
    await Board.findOneAndDelete({ name: board });
});
