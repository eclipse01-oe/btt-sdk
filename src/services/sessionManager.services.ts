import { Mutex } from "async-mutex";
import { CookiesDB } from "../model/cookiesDb.model";
import { saveCookiesSession } from "./session.services";
const SESSION_KEY = "bitcointalk";
export class SessionManager {
    private readonly mutex = new Mutex();
    private cookies: any[] | null = null;
    constructor(private readonly getSession: () => Promise<any[]>) { }
    public async getCookies() {
        if (this.cookies) {
            return this.cookies;
        }
        const db = await CookiesDB.findOne({ key: SESSION_KEY });
        if (db?.cookies?.length) {
            console.log("🍪 Session loaded from database");
            this.cookies = db.cookies;
            return this.cookies;
        }
        return this.refreshSession();
    }
    public async loadSession() {
        return this.getCookies();
    }
    private async saveCookies(cookies: any[]) {
        this.cookies = cookies;
        await saveCookiesSession(cookies);
        console.log("💾 Session saved");
    }
    public async refreshSession() {
        return this.mutex.runExclusive(() => this.doRefresh());
    }
    // extracted so invalidateSession can reuse the mutex-protected
    // refresh logic without deadlocking on a nested mutex.runExclusive
    private async doRefresh() {
        if (this.cookies) {
            return this.cookies;
        }
        const db = await CookiesDB.findOne({ key: SESSION_KEY });
        if (db?.cookies?.length) {
            console.log("🍪 Another request already refreshed session");
            this.cookies = db.cookies;
            return this.cookies;
        }
        console.log("🔁 Refreshing Bitcointalk session...");
        const cookies = await this.getSession();
        await this.saveCookies(cookies);
        console.log("✅ Session refreshed");
        return cookies;
    }
    public async invalidateSession(staleCookies?: any[] | null) {
        return this.mutex.runExclusive(async () => {
            // If the session already changed since the caller's request was
            // made, a sibling request already refreshed it — don't wipe it out.
            if (staleCookies !== undefined && this.cookies !== staleCookies) {
                console.log("↩️ Session already refreshed by another request — skipping");
                return this.cookies;
            }
            console.log("❌ Invalidating session");
            this.cookies = null;
            await CookiesDB.deleteOne({ key: SESSION_KEY });
            return this.doRefresh();
        });
    }
}
