import { chromium } from "playwright";
import { env } from "../config/zod";
export const getBttSession = async (username?: string, password?: string) => {
    if (!username || !password) {
        console.log("⚠ No credentials provided, skipping login");
        return [];
    }
    console.log("🔐 Launching Bitcointalk login...");
    const browser = await chromium.launch({
        headless: true,
    });
    const context = await browser.newContext({
        userAgent: env.USER_AGENT,
        viewport: {
            width: 1280,
            height: 800,
        },
    });
    const page = await context.newPage();
    try {
        await page.goto(env.LOGIN_PAGE, {
            waitUntil: "networkidle",
        });
        console.log("📝 Filling login form...");
        await page.fill("input[name='user']", username);
        await page.fill("input[name='passwrd']", password);
        await page.check("input[name='cookieneverexp']");
        await Promise.all([page.waitForLoadState("networkidle"), page.click("input[value='Login']")]);
        const html = await page.content();
        const cookies = await context.cookies();
        const loggedIn = html.includes("Logout") ||
            cookies.some((c) => c.name.includes("SMF") || c.name.includes("PHPSESSID"));
        console.log("🌍 URL:", page.url());
        console.log("🍪 Cookies:", cookies.map((c) => c.name));
        console.log("✅ Logged in:", loggedIn);
        if (!loggedIn) {
            console.log(html.slice(0, 1000));
            if (html.includes("Wrong password") ||
                html.includes("incorrect") ||
                page.url().includes("action=login")) {
                throw new Error("Invalid credentials");
            }
            throw new Error("Login failed");
        }
        console.log("✅ Bitcointalk login successful");
        return cookies;
    }
    finally {
        await context.close();
        await browser.close();
    }
};
