import { CookiesDB } from "../model/cookiesDb.model";
const SESSION_KEY = "bitcointalk";
export const saveCookiesSession = async (cookies: any[]) => {
    await CookiesDB.updateOne({ key: SESSION_KEY }, {
        key: SESSION_KEY,
        cookies,
    }, {
        upsert: true,
    });
};
