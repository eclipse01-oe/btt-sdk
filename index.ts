export { BttSDK } from "./src/sdk/bttSDK.class";
export { RequestManager } from "./src/services/requestManager.services";
export { SessionManager } from "./src/services/sessionManager.services";
export { SpamChecker } from "./src/services/spamChecker.services";
export type {
    BoardActivity, 
    BoardActivitySpamResult, 
    MatchedReply, 
    SpamActivity, 
    SpamCheckInput, 
    SpamCheckResult, 
    ThreadReply, 
    UserActivitySpamResult, 
} from "./src/utils/spamInterface.utils";
export { BttSDK as default } from "./src/sdk/bttSDK.class";
