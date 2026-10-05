import * as cheerio from "cheerio";
import { env } from "../../config/zod";
import { scraperHandler } from "../../config/asyncHandler";
import { ProfileUrl } from "../../utils/url.utils";
import * as r from "../../config/redis";
import { User } from "../../model/userData.model";
import { eventBus } from "../../event/eventBus";
import { Request } from "../../utils/url.utils";
export const getUser = (username: string, req: Request) => scraperHandler(async () => {
    const url = ProfileUrl(username);
    const page = await req.get(url);
    const $ = cheerio.load(String(page.data));
    const cells = $(".windowbg").find("table tr td");
    const img = $(".windowbg img")
        .map((_, el) => $(el).attr("src"))
        .get()[1];
    const userData: Record<string, string | boolean> = {};
    img ? (userData["image"] = `${env.BASE_URL}${img}`) : null;
    for (let i = 0; i < cells.length; i += 2) {
        const key = $(cells[i]).text().trim().replace(/[: ']/g, "");
        const value = $(cells[i + 1])
            .text()
            .trim()
            .replaceAll(`'`, "");
        if (key && value) {
            userData[key] = value;
            if (key === "Signature") {
                userData[key] = true;
            }
        }
    }
    if (Object.keys(userData).length === 0) {
        throw new Error(`User "${username}" not found`);
    }
    eventBus.emit("user:data", {
        username,
        data: userData,
    });
    await r.setRedis(`user-data:${username}`, userData);
    await User.updateOne({ username }, {
        $set: {
            username,
            userData,
        },
    }, {
        upsert: true,
    });
    return userData;
});
export const delUser = (username: string) => scraperHandler(async () => {
    await User.deleteMany({ username });
    await r.deleteRedis(`user-data:${username}`);
});
