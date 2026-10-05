import { env } from "../config/zod";
import { AxiosResponse } from "axios";
export const ProfileUrl = (username: string) => `${env.URL}action=profile;user=${username}`;
interface RequestOptions {
    authenticated?: boolean;
}
export interface Request {
    get<T = unknown>(url: string, options?: RequestOptions): Promise<AxiosResponse<T>>;
}
