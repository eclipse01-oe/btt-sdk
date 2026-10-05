import { RequestManager } from "./requestManager.services";
let req: RequestManager;
export const setReq = (request: RequestManager) => {
    req = request;
};
export const getReq = () => {
    if (!req) {
        throw new Error("RequestManager not set. Please call setReq() first.");
    }
    return req;
};
