import { EventEmitter } from "events";
import { redis } from "../config/redis";
import { connectDB } from "../config/db";
import { getBttSession } from "../services/playWrightLogin";
import { SessionManager } from "../services/sessionManager.services";
import { RequestManager } from "../services/requestManager.services";
import { UserWatcher } from "./userWatcher.class";
import { BoardWatcher } from "./boardWatchers.class";
import { setReq } from "../services/req.services";
import { getThreadReplies } from "../controller/threadPagesUrl";
import { SpamChecker } from "../services/spamChecker.services";
import { checkUserSpam } from "../workerJobs/activity.job";
export class BttSDK extends EventEmitter {
    private readonly ready: Promise<void>;
    public readonly session: SessionManager;
    public readonly request: RequestManager;
    private readonly userWatcher: UserWatcher;
    private readonly boardWatcher: BoardWatcher;
    private readonly spamChecker: SpamChecker;
    constructor(private readonly username?: string, private readonly password?: string) {
        super();
        this.session = new SessionManager(this.getSession.bind(this));
        this.request = new RequestManager(this.session);
        setReq(this.request);
        this.userWatcher = new UserWatcher(this, this.request);
        this.boardWatcher = new BoardWatcher(this, this.request);
        this.spamChecker = new SpamChecker();
        this.ready = this.connect();
    }
    private async connect() {
        console.log("⌛ SDK connecting.....");
        await redis.ping();
        console.log("✅ Redis connected");
        await connectDB();
        console.log("✅ MongoDB connected");
        await this.spamChecker.init();
        console.log("✅ Spam checker initialized");
        console.log("🚀 BttSDK initialized");
        await BoardWatcher.boardInit(this.request);
        console.log("✅ Board cache loaded");
    }
    public async waitUntilReady() {
        await this.ready;
    }
    public async getSession() {
        return getBttSession(this.username, this.password);
    }
    public async WatchUser(username: string, subscriber: string) {
        return this.userWatcher.watch(username, subscriber);
    }
    public async UnWatchUser(username: string, subscriber: string) {
        return this.userWatcher.unwatch(username, subscriber);
    }
    public async WatchBoard(board: string, subscriber: string) {
        return this.boardWatcher.watch(board, subscriber);
    }
    public async UnWatchBoard(board: string, subscriber: string) {
        return this.boardWatcher.unwatch(board, subscriber);
    }
    public async Spam(url: string, text: string) {
        const replies = await getThreadReplies(this.request, url);
        return this.spamChecker.checkSpam({ targetText: text, replies });
    }
    public async UserSpam(username: string, type: "post" | "reply") {
        return checkUserSpam(this.request, username, type, this.spamChecker);
    }
}
