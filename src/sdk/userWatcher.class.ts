import { BaseWatcher } from "./baseWatcher.class";
import { eventBus } from "../event/eventBus";
import { watchUser, delWatchUser } from "../event/user.event";
import type { BttSDK } from "./bttSDK.class";
import { RequestManager } from "../services/requestManager.services";
export class UserWatcher extends BaseWatcher {
    private readonly watchedUsers = new Map<string, Set<string>>();
    private eventsBound = false;
    private static userKey(username: string) {
        return username.trim().toLowerCase();
    }
    private addSubscriber(username: string, subscriber: string) {
        const key = UserWatcher.userKey(username);
        const subscribers = this.watchedUsers.get(key) ?? new Set<string>();
        subscribers.add(subscriber);
        this.watchedUsers.set(key, subscribers);
    }
    private removeSubscriber(username: string, subscriber: string) {
        const key = UserWatcher.userKey(username);
        const subscribers = this.watchedUsers.get(key);
        if (!subscribers)
            return;
        subscribers.delete(subscriber);
        if (!subscribers.size)
            this.watchedUsers.delete(key);
    }
    private readonly userDataListener = (data: any) => {
        if (!this.watchedUsers.has(UserWatcher.userKey(data.username)))
            return;
        this.sdk.emit("user:data", data);
    };
    private readonly meritSentListener = (data: any) => {
        if (!this.watchedUsers.has(UserWatcher.userKey(data.username)))
            return;
        this.sdk.emit("merit:sent", data);
    };
    private readonly meritReceivedListener = (data: any) => {
        if (!this.watchedUsers.has(UserWatcher.userKey(data.username)))
            return;
        this.sdk.emit("merit:received", data);
    };
    private readonly activityPostListener = (data: any) => {
        if (!this.watchedUsers.has(UserWatcher.userKey(data.username)))
            return;
        this.sdk.emit("activity:post", data);
    };
    private readonly activityReplyListener = (data: any) => {
        if (!this.watchedUsers.has(UserWatcher.userKey(data.username)))
            return;
        this.sdk.emit("activity:reply", data);
    };
    private readonly trustChangedListener = (data: any) => {
        if (!this.watchedUsers.has(UserWatcher.userKey(data.username)))
            return;
        this.sdk.emit("trust:changed", data);
    };
    constructor(private readonly sdk: BttSDK, private readonly request: RequestManager) {
        super();
        this.allowedEvents = new Set([
            "user:data",
            "merit:sent",
            "merit:received",
            "activity:post",
            "activity:reply",
            "trust:changed",
        ]);
    }
    private bindEvents() {
        if (this.eventsBound)
            return;
        eventBus.on("user:data", this.userDataListener);
        eventBus.on("merit:sent", this.meritSentListener);
        eventBus.on("merit:received", this.meritReceivedListener);
        eventBus.on("activity:post", this.activityPostListener);
        eventBus.on("activity:reply", this.activityReplyListener);
        eventBus.on("trust:changed", this.trustChangedListener);
        this.eventsBound = true;
    }
    private unbindEvents() {
        if (!this.eventsBound)
            return;
        eventBus.off("user:data", this.userDataListener);
        eventBus.off("merit:sent", this.meritSentListener);
        eventBus.off("merit:received", this.meritReceivedListener);
        eventBus.off("activity:post", this.activityPostListener);
        eventBus.off("activity:reply", this.activityReplyListener);
        eventBus.off("trust:changed", this.trustChangedListener);
        this.eventsBound = false;
    }
    async watch(username: string, subscriber: string) {
        await this.sdk.waitUntilReady();
        const key = UserWatcher.userKey(username);
        const result = await watchUser(key, subscriber, this.request);
        this.addSubscriber(key, subscriber);
        this.bindEvents();
        return result;
    }
    async unwatch(username: string, subscriber: string) {
        await this.sdk.waitUntilReady();
        const key = UserWatcher.userKey(username);
        const result = await delWatchUser(key, subscriber);
        this.removeSubscriber(key, subscriber);
        if (!this.watchedUsers.size)
            this.unbindEvents();
        return result;
    }
}
