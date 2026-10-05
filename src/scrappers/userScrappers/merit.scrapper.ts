import * as cheerio from "cheerio";
import { scraperHandler } from "../../config/asyncHandler";
import { Request } from "../../utils/url.utils";
export const getMerits = (url: string, req: Request) => scraperHandler(async () => {
    const meritPage = await req.get(url);
    const $ = cheerio.load(String(meritPage.data));
    const items = $("li").toArray();
    if (items.length === 0) {
        return null;
    }
    let sentMerits: string[] = [];
    let receivedMerits: string[] = [];
    items.map((el) => {
        const text = $(el).html() ?? "";
        if (/\d+\s+to\s+.+?\s+for/i.test(text)) {
            sentMerits.push(text);
        }
        else {
            receivedMerits.push(text);
        }
    });
    return { sentMerits, receivedMerits };
});
export const sentMerit = (data: string) => scraperHandler(async () => {
    const html = data ?? "";
    if (!html.trim())
        return null;
    const $ = cheerio.load(html);
    const root = $.root();
    const text = root.text().trim();
    const links = root
        .find("a")
        .map((_, a) => $(a).attr("href"))
        .get();
    const linksText = root
        .find("a")
        .map((_, a) => $(a).text())
        .get();
    const meritAmount = Number(text.match(/:\s*(\d+)\s+to/i)?.[1] ?? 0);
    const rawEventAt = text.match(/^(.*?):\s*\d+\s+to/i)?.[1]?.trim();
    const eventAt = rawEventAt ? new Date(rawEventAt) : null;
    return {
        type: "sent",
        meritAmount,
        user: {
            name: linksText[0] ?? null,
            url: links[0] ?? null,
        },
        post: {
            name: linksText[1] ?? null,
            url: links[1] ?? null,
        },
        rawFullText: text,
        rawEventAt,
        eventAt,
    };
});
export const receivedMerit = (data: string) => scraperHandler(async () => {
    const html = data ?? "";
    if (!html.trim())
        return null;
    const $ = cheerio.load(html);
    const root = $.root();
    const text = root.text().trim();
    const links = root
        .find("a")
        .map((_, a) => $(a).attr("href"))
        .get();
    const linksText = root
        .find("a")
        .map((_, a) => $(a).text())
        .get();
    const meritAmount = Number(text.match(/:\s*(\d+)\s+from/i)?.[1] ?? 0);
    const rawEventAt = text.match(/^(.*?):\s*\d+\s+from/i)?.[1]?.trim();
    const eventAt = rawEventAt ? new Date(rawEventAt) : null;
    return {
        type: "received",
        meritAmount,
        user: {
            name: linksText[0] ?? null,
            url: links[0] ?? null,
        },
        post: {
            name: linksText[1] ?? null,
            url: links[1] ?? null,
        },
        rawFullText: text,
        rawEventAt,
        eventAt,
    };
});
export const callMerits = async (req: Request, url: string) => {
    const result = await getMerits(url, req);
    const sentMerits = result?.sentMerits ?? [];
    const receivedMerits = result?.receivedMerits ?? [];
    const sent = sentMerits.length > 0 ? await sentMerit(sentMerits[0]) : null;
    const received = receivedMerits.length > 0 ? await receivedMerit(receivedMerits[0]) : null;
    return { sent, received };
};
export const callFullMerits = async (req: any, url: string) => {
    const result = await getMerits(url, req);
    const sentMerits = result?.sentMerits ?? [];
    const receivedMerits = result?.receivedMerits ?? [];
    const sent: Object[] = [];
    const received: Object[] = [];
    for (let c of sentMerits) {
        const sm = await sentMerit(c);
        if (sm !== null)
            sent.push(sm);
    }
    for (let c of receivedMerits) {
        const rm = await receivedMerit(c);
        if (rm !== null)
            received.push(rm);
    }
    return { sent, received };
};
