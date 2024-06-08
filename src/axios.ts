import {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosStatic,
  InternalAxiosRequestConfig,
} from "axios";

import { asyncLocalStorage, Config } from "./apitoolkit";
import { ATError, Payload, redactFields, redactHeaders } from "./payload";

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    meta: any;
  }
}

export const onRequest = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  config.meta = { startTime: process.hrtime.bigint() };
  return config;
};

export const onRequestError = (error: AxiosError): Promise<AxiosError> => {
  return Promise.reject(error);
};

function processResponse(
  response: AxiosResponse | AxiosError,
  urlWildcard: string | undefined,
  redactHeaderLists: string[],
  redactRequestBody: string[],
  redactResponseBody: string[],
  notWebContext: boolean,
  isGlobal: boolean,
  client: any
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

  if (notWebContext && client) {
    const config = client.getConfig();
    const project_id = config.project_id;
    const ATConfig: Config = config.config;
    const parent_id: any = undefined;

    const errors: ATError[] = [];

    const payload = buildPayload(
      response.config?.meta.startTime,
      req,
      res,
      reqBody,
      respBody,
      redactRequestBody,
      redactResponseBody,
      redactHeaderLists,
      project_id,
      ATConfig.serviceVersion,
      errors,
      ATConfig.tags ?? [],
      parent_id,
      urlWildcard
    );
    client.publishMessage(payload);
  } else {
    let config;
    let ATClient;
    let project_id;
    let ATConfig;
    let parent_id;
    const store = asyncLocalStorage.getStore();

    if (isGlobal) {
      config = client.getConfig();
      ATClient = client;
      project_id = config.project_id;
      ATConfig = config.config;
      parent_id = store?.get("AT_msg_id");
    } else {
      project_id = store!.get("AT_project_id");
      ATClient = store!.get("AT_client");
      ATConfig = store!.get("AT_config");
      parent_id = store!.get("AT_msg_id");
    }

    const errors: ATError[] = [];

    const payload = buildPayload(
      response.config?.meta.startTime,
      req,
      res,
      reqBody,
      respBody,
      redactRequestBody,
      redactResponseBody,
      redactHeaderLists,
      project_id,
      ATConfig.serviceVersion,
      errors,
      ATConfig.tags ?? [],
      parent_id,
      urlWildcard
    );

    ATClient.publishMessage(payload);
  }
}

export const onResponse =
  (
    urlWildcard: string | undefined,
    redactHeaderLists: string[],
    redactRequestBody: string[],
    redactResponseBody: string[],
    notWebContext: boolean,
    isGlobal: boolean,
    client: any
  ) =>
  (response: AxiosResponse): AxiosResponse => {
    try {
      if (asyncLocalStorage.getStore() == null && !notWebContext && !isGlobal) {
        console.log(
          "APIToolkit: observeAxios used outside of the APIToolkit middleware's scope. Use the APIToolkitClient.observeAxios instead, if you're not in a web context."
        );
        return response;
      }
      processResponse(
        response,
        urlWildcard,
        redactHeaderLists,
        redactRequestBody,
        redactResponseBody,
        notWebContext,
        isGlobal,
        client
      );
      return response;
    } catch (_error) {
      return response;
    }
  };

export const onResponseError =
  (
    urlWildcard: string | undefined,
    redactHeaderLists: string[],
    redactRequestBody: string[],
    redactResponseBody: string[],
    notWebContext: boolean,
    isGlobal: boolean,
    client: any
  ) =>
  (error: AxiosError): Promise<AxiosError> => {
    try {
      if (asyncLocalStorage.getStore() == null && !notWebContext && !isGlobal) {
        console.log(
          "APIToolkit: observeAxios used outside of the APIToolkit middleware's scope. Use the APIToolkitClient.observeAxios instead, if you're not in a web context."
        );
        return Promise.reject(error);
      }
      processResponse(
        error,
        urlWildcard,
        redactHeaderLists,
        redactRequestBody,
        redactResponseBody,
        notWebContext,
        isGlobal,
        client
      );
      return Promise.reject(error);
    } catch (_error) {
      return Promise.reject(error);
    }
  };

export function observeAxios(
  axiosInstance: AxiosStatic,
  urlWildcard: string | undefined = undefined,
  redactHeaders: string[] = [],
  redactRequestBody: string[] = [],
  redactResponseBody: string[] = [],
  notWebContext: boolean | undefined = false,
  client: any = undefined
): AxiosInstance {
  const newAxios = axiosInstance.create();
  newAxios.interceptors.request.use(onRequest, onRequestError);
  newAxios.interceptors.response.use(
    onResponse(
      urlWildcard,
      redactHeaders,
      redactRequestBody,
      redactResponseBody,
      !!notWebContext,
      false,
      client
    ),
    onResponseError(
      urlWildcard,
      redactHeaders,
      redactRequestBody,
      redactResponseBody,
      !!notWebContext,
      false,
      client
    )
  );
  return newAxios;
}

export function observeAxiosGlobal(
  axiosInstance: AxiosInstance,
  urlWildcard: string | undefined = undefined,
  redactHeaders: string[] = [],
  redactRequestBody: string[] = [],
  redactResponseBody: string[] = [],
  client: any = undefined
) {
  axiosInstance.interceptors.request.use(onRequest, onRequestError);
  axiosInstance.interceptors.response.use(
    onResponse(
      urlWildcard,
      redactHeaders,
      redactRequestBody,
      redactResponseBody,
      false,
      true,
      client
    ),
    onResponseError(
      urlWildcard,
      redactHeaders,
      redactRequestBody,
      redactResponseBody,
      false,
      true,
      client
    )
  );
}
export function buildPayload(
  start_time: bigint,
  req: AxiosRequestConfig,
  res: AxiosResponse | undefined,
  reqBody: string,
  respBody: string,
  redactRequestBody: string[],
  redactResponseBody: string[],
  redactHeaderLists: string[],
  project_id: string,
  serviceVersion: string | undefined,
  errors: ATError[],
  tags: string[],
  parent_id: string,
  urlWildcard: string | undefined
): Payload {
  const reqObjEntries: Array<[string, string[]]> = Object.entries(
    req.headers || {}
  ).map(([k, v]: [string, any]): [string, string[]] => [
    k,
    Array.isArray(v) ? v : [v],
  ]);
  const reqHeaders = new Map<string, string[]>(reqObjEntries);

  const resObjEntries: Array<[string, string[]]> = Object.entries(
    res?.headers ?? []
  ).map(([k, v]: [string, any]): [string, string[]] => [
    k,
    Array.isArray(v) ? v : [v],
  ]);
  const resHeaders = new Map<string, string[]>(resObjEntries);
  const {
    path: urlPath,
    rawUrl,
    queryParams: params,
  } = getPathAndQueryParamsFromURL(req.url ?? "");
  const queryObjEntries = Object.entries(req.params || params).map(([k, v]) => {
    if (typeof v === "string") return [k, [v]];
    return [k, v];
  });
  const queryParams = Object.fromEntries(queryObjEntries);
  const host = getHostFromUrl(req.baseURL || req.url || "");
  const payload: Payload = {
    duration: Number(process.hrtime.bigint() - start_time),
    host: host,
    method: req.method?.toUpperCase() ?? "",
    path_params: {}, // Axios does not have a direct equivalent to Express' path parameters
    project_id: project_id,
    proto_minor: 1, // Update as needed
    proto_major: 1, // Update as needed
    query_params: queryParams,
    raw_url: rawUrl,
    referer: req.headers?.referer ?? "",
    request_body: Buffer.from(
      redactFields(reqBody, redactRequestBody)
    ).toString("base64"),
    request_headers: redactHeaders(reqHeaders, redactHeaderLists),
    response_body: Buffer.from(
      redactFields(respBody, redactResponseBody)
    ).toString("base64"),
    response_headers: redactHeaders(resHeaders, redactHeaderLists),
    sdk_type: "JsAxiosOutgoing", // Update the sdk_type since this is not Express.js anymore
    status_code: res?.status || 404,
    timestamp: new Date().toISOString(),
    url_path: urlWildcard ?? urlPath,
    service_version: serviceVersion,
    errors: errors,
    tags: tags,
    parent_id: parent_id,
  };
  return payload;
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
