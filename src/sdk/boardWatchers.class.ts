import { BaseWatcher } from "./baseWatcher.class";
import type { BttSDK } from "./bttSDK.class";
import { RequestManager } from "../services/requestManager.services";
import { boardEventHub } from "../event/boardEventHub";
import { getBoards, WatchBoard, DelWatchBoard } from "../event/board.event";
import type { BoardActivity, BoardActivitySpamResult } from "../utils/spamInterface.utils";

export class BoardWatcher extends BaseWatcher {
    private static isBoardCacheLoaded = false;
    private readonly watchedBoards = new Map<string, Set<string>>();
    private readonly boardUnsubscribers = new Map<string, () => void>();

    constructor(private readonly sdk: BttSDK, private readonly req: RequestManager) {
        super();
        this.allowedEvents = new Set(["board:new", "board:spam"]);
    }

    private static boardKey(board: string) {
        return board.trim().toLowerCase();
    }

    private addSubscriber(board: string, subscriber: string) {
        const key = BoardWatcher.boardKey(board);
        const subscribers = this.watchedBoards.get(key) ?? new Set<string>();
        subscribers.add(subscriber);
        this.watchedBoards.set(key, subscribers);
    }

    private removeSubscriber(board: string, subscriber: string) {
        const key = BoardWatcher.boardKey(board);
        const subscribers = this.watchedBoards.get(key);
        if (!subscribers) {
            return;
        }

        subscribers.delete(subscriber);
        if (!subscribers.size) {
            this.watchedBoards.delete(key);
        }
    }

    static async boardInit(req: RequestManager) {
        if (this.isBoardCacheLoaded) {
            return;
        }

        await getBoards(req);
        this.isBoardCacheLoaded = true;
    }

    private async bindBoardEvents(board: string) {
        const key = BoardWatcher.boardKey(board);
        if (this.boardUnsubscribers.has(key)) {
            return;
        }

        const unsubscribe = await boardEventHub.subscribe(key, {
            onBoard: (data: BoardActivity) => {
                if (!this.watchedBoards.has(key)) {
                    return;
                }
                this.sdk.emit("board:new", data);
            },
            onSpam: (data: BoardActivitySpamResult) => {
                if (!this.watchedBoards.has(key)) {
                    return;
                }
                this.sdk.emit("board:spam", data);
            },
        });

        this.boardUnsubscribers.set(key, unsubscribe);
    }

    private unbindBoardEvents(board: string) {
        const key = BoardWatcher.boardKey(board);
        const unsubscribe = this.boardUnsubscribers.get(key);
        if (!unsubscribe) {
            return;
        }

        unsubscribe();
        this.boardUnsubscribers.delete(key);
    }

    async watch(board: string, subscriber: string) {
        await this.sdk.waitUntilReady();

        const key = BoardWatcher.boardKey(board);
        const result = await WatchBoard(this.req, key, subscriber);
        this.addSubscriber(key, subscriber);

        try {
            await this.bindBoardEvents(key);
        } catch (error) {
            this.removeSubscriber(key, subscriber);
            await DelWatchBoard(subscriber, key);
            throw error;
        }

        return result;
    }

    async unwatch(board: string, subscriber: string) {
        await this.sdk.waitUntilReady();

        const key = BoardWatcher.boardKey(board);
        const result = await DelWatchBoard(subscriber, key);
        this.removeSubscriber(key, subscriber);

        if (!this.watchedBoards.has(key)) {
            this.unbindBoardEvents(key);
        }

        return result;
    }
}
