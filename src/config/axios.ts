import axios from "axios";
import https from "https";
import { env } from "./zod";

export const createAxios = () => {
  return axios.create({
    baseURL: env.URL,
    timeout: 15000,
    headers: {
      "User-Agent": env.USER_AGENT,
      Accept: env.ACCEPT,
      "Accept-Language": env.ACCEPT_LANGUAGE,
    },
    httpsAgent: new https.Agent({
      family: 4,
      keepAlive: true,
    }),
  });
};
