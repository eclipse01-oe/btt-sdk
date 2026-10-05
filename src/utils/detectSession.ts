import * as cheerio from "cheerio";
export const isSessionInvalid = (res: any) => {
    if (typeof res.data !== "string") {
        return false;
    }
    const $ = cheerio.load(res.data);
    if ($("#hellomember").length > 0) {
        return false;
    }
    if ($("a[href*='action=logout']").length > 0) {
        return false;
    }
    if ($("input[name='user']").length && $("input[name='passwrd']").length) {
        return true;
    }
    if ($("body").text().includes("Welcome, Guest")) {
        return true;
    }
    if ($("body").text().includes("Session verification failed")) {
        return true;
    }
    return false;
};
