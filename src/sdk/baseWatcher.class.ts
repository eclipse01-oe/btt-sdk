import { EventEmitter } from "events";
export abstract class BaseWatcher extends EventEmitter {
    protected allowedEvents = new Set<string>();
    override on(event: string, listener: (...args: any[]) => void) {
        if (this.allowedEvents.size > 0 && !this.allowedEvents.has(event)) {
            throw new Error(`Unsupported event "${event}"`);
        }
        return super.on(event, listener);
    }
}
