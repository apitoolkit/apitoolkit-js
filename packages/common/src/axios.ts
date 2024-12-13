import {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  AxiosStatic,
  InternalAxiosRequestConfig,
} from "axios";
import { v4 as uuidv4 } from "uuid";

import { asyncLocalStorage, Config, setAttributes } from "./apitoolkit";
import { trace } from "@opentelemetry/api";

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    meta: any;
  }
}

export const onRequest = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  const span = trace.getTracer("").startSpan("apitoolkit-http-span");
  config.meta = { span };
  return config;
};

export const onRequestError = (error: AxiosError): Promise<AxiosError> => {
  return Promise.reject(error);
};

function processResponse(
  response: AxiosResponse | AxiosError,
  config: Config,
  urlWildcard: string | undefined
) {
  let req: any = response.config;
  let res: AxiosResponse | undefined;
  if (response instanceof Error) {
    res = response.response;
    req = response.request;
  } else {
    res = response;
  }

  const reqBody =
    typeof req?.data === "string" ? req.data : JSON.stringify(req?.data || {});
  const respBody =
    typeof res?.data === "string" ? res?.data : JSON.stringify(res?.data || {});

  const span = response.config?.meta.span;
  const {
    path,
    rawUrl,
    queryParams: params,
  } = getPathAndQueryParamsFromURL(req.url ?? "");
  const queryObjEntries = Object.entries(req.params || params).map(([k, v]) => {
    if (typeof v === "string") return [k, [v]];
    return [k, v];
  });
  const msg_id = uuidv4();
  const queryParams = Object.fromEntries(queryObjEntries);
  const host = getHostFromUrl(req.baseURL || req.url || "");
  const store = asyncLocalStorage.getStore();
  let parent_id;
  if (store) {
    parent_id = store.get("AT_msg_id");
  }
  const urlPath = urlWildcard ? urlWildcard : path;
  setAttributes(
    span,
    host,
    res?.status || 0,
    queryParams,
    req.params || {},
    req.headers,
    res?.headers || {},
    req.method?.toUpperCase() ?? "",
    rawUrl,
    msg_id,
    urlPath,
    reqBody,
    respBody,
    config,
    "JsExpress",
    parent_id
  );
}

export const onResponse =
  (config: Config, urlWildcard: string | undefined) =>
  (response: AxiosResponse): AxiosResponse => {
    try {
      processResponse(response, config, urlWildcard);
      return response;
    } catch (_error) {
      return response;
    }
  };

export const onResponseError =
  (config: Config, urlWildcard: string | undefined) =>
  (error: AxiosError): Promise<AxiosError> => {
    try {
      processResponse(error, config, urlWildcard);
      return Promise.reject(error);
    } catch (_error) {
      return Promise.reject(error);
    }
  };

type AxiosConfig = {
  axiosInstance: AxiosStatic;
  urlWildcard: string | undefined;
  redactHeaders: string[];
  redactRequestBody: string[];
  redactResponseBody: string[];
};
export function observeAxios({
  axiosInstance,
  urlWildcard,
  redactHeaders,
  redactRequestBody,
  redactResponseBody,
}: AxiosConfig): AxiosInstance {
  const newAxios = axiosInstance.create();
  newAxios.interceptors.request.use(onRequest, onRequestError);
  const config: Config = {
    redactHeaders: redactHeaders,
    redactRequestBody: redactRequestBody,
    redactResponseBody: redactResponseBody,
  };
  newAxios.interceptors.response.use(
    onResponse(config, urlWildcard),
    onResponseError(config, urlWildcard)
  );
  return newAxios;
}

export function observeAxiosGlobal(
  axiosInstance: AxiosInstance,
  config: Config
) {
  axiosInstance.interceptors.request.use(onRequest, onRequestError);
  axiosInstance.interceptors.response.use(
    onResponse(config, undefined),
    onResponseError(config, undefined)
  );
}

function getPathAndQueryParamsFromURL(url: string) {
  try {
    const urlObject = new URL(url);
    const path = urlObject.pathname;
    const queryParams: { [key: string]: string } = {};
    const queryParamsString = urlObject.search;
    urlObject.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    return { path, queryParams, rawUrl: path + queryParamsString };
  } catch (error) {
    return { path: "", queryParams: {}, rawUrl: "" };
  }
}
function getHostFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.host;
  } catch (error) {
    return "";
  }
}
