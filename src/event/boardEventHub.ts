import type { Redis } from "ioredis";
import { redis } from "../config/redis";
import type { BoardActivity, BoardActivitySpamResult } from "../utils/spamInterface.utils";

export const BOARD_EVENT_CHANNEL = "btt:board:events";

type BoardEvent =
    | { type: "board:new"; board: string; data: BoardActivity }
    | { type: "board:spam"; board: string; data: BoardActivitySpamResult };

type BoardEventListener = {
    onBoard: (data: BoardActivity) => void;
    onSpam: (data: BoardActivitySpamResult) => void;
};

class BoardEventHub {
    private subscriber: Redis | null = null;
    private readonly listeners = new Map<string, Set<BoardEventListener>>();
    private connecting: Promise<void> | null = null;

    private boardKey(board: string) {
        return board.trim().toLowerCase();
    }

    private async ensureSubscriber() {
        if (this.subscriber?.status === "ready") {
            return;
        }

        if (this.connecting) {
            await this.connecting;
            return;
        }

        this.connecting = (async () => {
            const subscriber = redis.duplicate();
            subscriber.on("error", (error) => {
                console.error("[BoardEventHub Redis]:", error.message);
            });

            if (subscriber.status === "wait") {
                await subscriber.connect();
            }

            await subscriber.subscribe(BOARD_EVENT_CHANNEL);

            subscriber.on("message", (_channel, message) => {
                this.dispatch(message);
            });

            this.subscriber = subscriber;
        })();

        try {
            await this.connecting;
        } finally {
            this.connecting = null;
        }
    }

    private dispatch(message: string) {
        let event: BoardEvent;

        try {
            event = JSON.parse(message) as BoardEvent;
        } catch (error) {
            console.error("[BoardEventHub] Invalid event payload", error);
            return;
        }

        const listeners = this.listeners.get(this.boardKey(event.board));
        if (!listeners) {
            return;
        }

        if (event.type === "board:new") {
            const data = {
                ...event.data,
                eventAt: new Date(event.data.eventAt),
            };

            for (const listener of listeners) {
                listener.onBoard(data);
            }
            return;
        }

        const data = {
            ...event.data,
            activity: {
                ...event.data.activity,
                eventAt: new Date(event.data.activity.eventAt),
            },
        };

        for (const listener of listeners) {
            listener.onSpam(data);
        }
    }

    async subscribe(board: string, listener: BoardEventListener) {
        const key = this.boardKey(board);
        const listeners = this.listeners.get(key) ?? new Set<BoardEventListener>();
        listeners.add(listener);
        this.listeners.set(key, listeners);

        try {
            await this.ensureSubscriber();
        } catch (error) {
            this.unsubscribe(key, listener);
            throw error;
        }

        return () => this.unsubscribe(key, listener);
    }

    private unsubscribe(board: string, listener: BoardEventListener) {
        const listeners = this.listeners.get(board);
        if (!listeners) {
            return;
        }

        listeners.delete(listener);
        if (!listeners.size) {
            this.listeners.delete(board);
        }
    }
}

export const boardEventHub = new BoardEventHub();

export const publishBoardEvent = async (
    type: BoardEvent["type"],
    board: string,
    data: BoardActivity | BoardActivitySpamResult,
) => {
    const payload: BoardEvent = {
        type,
        board: board.trim().toLowerCase(),
        data: data as never,
    };

    await redis.publish(BOARD_EVENT_CHANNEL, JSON.stringify(payload));
};
