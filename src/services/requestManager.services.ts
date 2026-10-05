import axios, { AxiosHeaders } from "axios";
import PQueue from "p-queue";
import { createAxios } from "../config/axios";
import { SessionManager } from "./sessionManager.services";
import { isSessionInvalid } from "../utils/detectSession";
import { toCookieHeader } from "../utils/cookieHeader";
import { Request } from "../utils/url.utils";
declare module "axios" {
    interface AxiosRequestConfig {
        authenticated?: boolean;
        hadSession?: boolean;
    }
    interface InternalAxiosRequestConfig {
        authenticated?: boolean;
        hadSession?: boolean;
    }
}
export class RequestManager implements Request {
    private readonly api = createAxios();
    private readonly queue = new PQueue({
        concurrency: 3,
        intervalCap: 5,
        interval: 1000,
        carryoverConcurrencyCount: true,
    });
    constructor(private readonly session: SessionManager) {
        this.registerInterceptors();
    }
    private registerInterceptors() {
        this.api.interceptors.request.use(async (config) => {
            if (config.authenticated === false) {
                return config;
            }
            const cookies = await this.session.getCookies();
            if (!cookies?.length) {
                console.log("⚠ No cookies available, proceeding anonymous");
                config.hadSession = false;
                return config;
            }
            const headers = new AxiosHeaders(config.headers);
            headers.set("Cookie", toCookieHeader(cookies));
            config.headers = headers;
            config.hadSession = true;
            return config;
        });
        this.api.interceptors.response.use((res) => {
            if (res.config.authenticated === false) {
                return res;
            }
            if (res.config.hadSession === false) {
                return res;
            }
            if (isSessionInvalid(res)) {
                console.log("⚠ Session expired");
                throw new Error("SESSION_INVALID");
            }
            return res;
        });
    }
    public get(url: string, options: {
        authenticated?: boolean;
    } = {}) {
        const authenticated = options.authenticated ?? true;
        return this.queue.add(() => this.execute(() => this.api.get(url, {
            authenticated,
        }), 3, authenticated));
    }
    private async execute<T>(req: () => Promise<T>, retries = 5, authenticated = true): Promise<T> {
        let usedCookies: any[] | null | undefined;
        try {
            if (authenticated) {
                usedCookies = await this.session.loadSession();
            }
            return await req();
        }
        catch (err: any) {
            console.log(`❌ Request failed (${retries})`, err.message);
            if (err.message === "SESSION_INVALID" && retries > 0) {
                await this.session.invalidateSession(usedCookies);
                return this.execute(req, retries - 1, authenticated);
            }
            if (axios.isAxiosError(err) && err.response?.status === 503 && retries > 0) {
                console.log("⏳ 503 detected. Retrying...");
                await new Promise((r) => setTimeout(r, 2000));
                return this.execute(req, retries - 1, authenticated);
            }
            throw err;
        }
    }
}
