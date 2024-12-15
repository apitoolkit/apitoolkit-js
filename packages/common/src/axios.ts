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
  reqContext: any | undefined,
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

  let parentId;
  if (reqContext) {
    const ctx = reqContext.get();
    if (ctx && ctx.apitoolkitData) {
      parentId = ctx.apitoolkitData.msgId;
    }
  } else {
    const store = asyncLocalStorage.getStore();
    if (store) {
      parentId = store.get("AT_msg_id");
    }
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
    [],
    config,
    "JsAxiosOutgoing",
    parentId
  );
}

export const onResponse =
  (
    config: Config,
    reqContext: any | undefined,
    urlWildcard: string | undefined
  ) =>
  (response: AxiosResponse): AxiosResponse => {
    try {
      processResponse(response, config, reqContext, urlWildcard);
      return response;
    } catch (_error) {
      return response;
    }
  };

export const onResponseError =
  (
    config: Config,
    reqContext: any | undefined,
    urlWildcard: string | undefined
  ) =>
  (error: AxiosError): Promise<AxiosError> => {
    try {
      processResponse(error, config, reqContext, urlWildcard);
      return Promise.reject(error);
    } catch (_error) {
      return Promise.reject(error);
    }
  };

export type AxiosConfig = {
  axiosInstance: AxiosStatic;
  urlWildcard?: string;
  redactHeaders?: string[];
  redactRequestBody?: string[];
  redactResponseBody?: string[];
  requestContext?: any;
};
export function observeAxios({
  axiosInstance,
  urlWildcard,
  redactHeaders,
  redactRequestBody,
  redactResponseBody,
  requestContext,
}: AxiosConfig): AxiosInstance {
  const newAxios = axiosInstance.create();
  newAxios.interceptors.request.use(onRequest, onRequestError);
  const config: Config = {
    redactHeaders: redactHeaders,
    redactRequestBody: redactRequestBody,
    redactResponseBody: redactResponseBody,
  };
  newAxios.interceptors.response.use(
    onResponse(config, requestContext, urlWildcard),
    onResponseError(config, requestContext, urlWildcard)
  );
  return newAxios;
}

export function observeAxiosGlobal(
  axiosInstance: AxiosInstance,
  config: Config,
  reqContext?: any
) {
  axiosInstance.interceptors.request.use(onRequest, onRequestError);
  axiosInstance.interceptors.response.use(
    onResponse(config, reqContext, undefined),
    onResponseError(config, reqContext, undefined)
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
