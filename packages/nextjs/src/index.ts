import { asyncLocalStorage, Config, setAttributes } from "@apitoolkit/common";

import { trace } from "@opentelemetry/api";
import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

export { observeAxios, ReportError as reportError } from "@apitoolkit/common";

type AppRouterResponse = Promise<Response> | Response;

export function APItoolkitAppRouterWrapper(
  handler:
    | ((request: Request, params?: unknown) => AppRouterResponse)
    | ((request: NextRequest, params?: unknown) => AppRouterResponse),
  config?: Config
) {
  const span = trace
    .getTracer(config?.serviceName || "")
    .startSpan("apitoolkit-http-span");

  return async (request: Request | NextRequest, params?: unknown) => {
    return asyncLocalStorage.run(new Map(), async () => {
      const store = asyncLocalStorage.getStore();
      const msg_id = uuidv4();
      if (store) {
        store.set("AT_msg_id", msg_id);
        store.set("AT_errors", []);
      }
      const reqClon = request.clone() as NextRequest;
      const response = await handler(request as NextRequest, params);
      const reqBody = config?.captureRequestBody ? await reqClon.text() : "";
      const resClone = response.clone();
      const respBody = config?.captureResponseBody ? await resClone.text() : "";
      const url = new URL(request.url);

      setAttributes(
        span,
        url.hostname,
        response.status,
        Object.fromEntries(url.searchParams.entries()),
        params || {},
        Object.fromEntries(request.headers.entries()),
        Object.fromEntries(response.headers.entries()),
        request.method,
        url.pathname + url.search,
        msg_id,
        (request as NextRequest).nextUrl.pathname,
        reqBody,
        respBody,
        asyncLocalStorage.getStore()?.get("AT_errors") || [],
        config || {},
        "JsNext",
        undefined
      );

      return response;
    });
  };
}

export function APItoolkitPagesRouterWrapper(
  handler: NextApiHandler,
  config?: Config
) {
  return async (request: NextApiRequest, response: NextApiResponse) => {
    const span = trace
      .getTracer(config?.serviceName || "")
      .startSpan("apitoolkit-http-span");

    return asyncLocalStorage.run(new Map(), async () => {
      const store = asyncLocalStorage.getStore();
      const msg_id = uuidv4();
      if (store) {
        store.set("AT_msg_id", msg_id);
        store.set("AT_errors", []);
      }
      const reqBody = request.body;

      let responseBody = "";
      const originalJson = response.json.bind(response);
      response.json = (body) => {
        responseBody = body; // Capture the response body
        return originalJson(body); // Call the original method
      };

      const res = await handler(request, response);
      const query = request.url?.split("?")[1] || "";
      const queryParams = query
        ? Object.fromEntries(new URLSearchParams(query))
        : {};

      const pathParams: Record<string, string | string[]> = {};
      Object.keys(request.query).forEach((key) => {
        if (!(key in queryParams)) {
          if (request.query[key]) {
            pathParams[key] = request.query[key];
          }
        }
      });
      responseBody =
        typeof responseBody === "string"
          ? responseBody
          : safeJSon(responseBody);
      setAttributes(
        span,
        request.headers.host || "",
        response.statusCode,
        queryParams,
        pathParams,
        request.headers,
        response.getHeaders(),
        request.method || "",
        request.url || "",
        msg_id,
        request.url || "",
        reqBody,
        responseBody,
        asyncLocalStorage.getStore()?.get("AT_errors") || [],
        config || {},
        "JsNext",
        undefined
      );

      return res;
    });
  };
}

function safeJSon(obj: any) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return "";
  }
}
