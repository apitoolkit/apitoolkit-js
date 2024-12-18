import { trace } from "@opentelemetry/api";
import { Exception, Span } from "@opentelemetry/api";
import { AxiosInstance } from "axios";

import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

type AppRouterResponse = Promise<Response> | Response;

export function withAPItoolkitAppRouter(
  handler:
    | ((request: Request, params?: unknown) => AppRouterResponse)
    | ((request: NextRequest, params?: unknown) => AppRouterResponse),
  config?: Config
) {
  return async (request: Request | NextRequest, params?: unknown) => {
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
      const reqClon = request.clone() as NextRequest;
      const response = await handler(request as NextRequest, params);

      try {
        const reqBody = config?.captureRequestBody ? await reqClon.text() : "";
        const resClone = response.clone();
        const respBody = config?.captureResponseBody
          ? await resClone.text()
          : "";
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
      } catch (_error) {
      } finally {
        return response;
      }
    });
  };
}

export function withAPItoolkitPagesRouter(
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
      try {
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
      } catch (error) {
      } finally {
        return res;
      }
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

// ATError is the Apitoolkit error type/object
export type ATError = {
  when: string; // timestamp
  error_type: string;
  root_error_type?: string;
  message: string;
  root_error_message?: string;
  stack_trace: string;
};

export function setAttributes(
  span: Span,
  host: string,
  statusCode: number,
  queryParams: Record<string, any>,
  pathParams: Record<string, any>,
  reqHeaders: Record<string, any>,
  respHeaders: Record<string, any>,
  method: string,
  rawUrl: string,
  msg_id: string,
  urlPath: string,
  reqBody: string,
  respBody: string,
  errors: ATError[],
  config: Config,
  sdkType:
    | `JsExpress`
    | `JsFastify`
    | `JsAdonis`
    | "JsAxiosOutgoing"
    | "JsNext",
  parentId: string | undefined
) {
  try {
    span.setAttributes({
      "net.host.name": host,
      "apitoolkit.msg_id": msg_id,
      "http.route": urlPath,
      "http.target": rawUrl,
      "http.request.method": method,
      "http.response.status_code": statusCode,
      "http.request.query_params": JSON.stringify(queryParams),
      "http.request.path_params": JSON.stringify(pathParams),
      "apitoolkit.sdk_type": sdkType,
      "apitoolkit.parent_id": parentId || "",
      "http.request.body": Buffer.from(reqBody).toString("base64"),
      "http.response.body": Buffer.from(respBody).toString("base64"),
      "apitoolkit.errors": JSON.stringify(errors),
      "apitoolkit.service_version": config.serviceVersion || "",
      "apitoolkit.tags": config.tags || [],
    });

    const redactHeader = (header: string) =>
      config.redactHeaders?.includes(header.toLowerCase()) ||
      ["cookies", "authorization"].includes(header.toLowerCase())
        ? "[CLIENT_REDACTED]"
        : header;

    Object.entries(reqHeaders).forEach(([header, value]) =>
      span.setAttribute(
        `http.request.header.${header}`,
        redactHeader(String(value))
      )
    );
    Object.entries(respHeaders).forEach(([header, value]) =>
      span.setAttribute(
        `http.response.header.${header}`,
        redactHeader(String(value))
      )
    );
  } catch (error) {
    span.recordException(error as Exception);
  } finally {
    span.end();
  }
}

export function redactHeaders(
  headers: Map<string, string[]>,
  headersToRedact: string[]
) {
  const redactedHeaders: { [key: string]: string[] } = {};
  const headersToRedactLowerCase = headersToRedact.map((header) =>
    header.toLowerCase()
  );

  for (const [key, value] of headers) {
    const lowerKey = key.toLowerCase();
    const isRedactKey =
      headersToRedactLowerCase.includes(lowerKey) || lowerKey === "cookie";
    redactedHeaders[key] = isRedactKey ? ["[CLIENT_REDACTED]"] : value;
  }

  return redactedHeaders;
}

export type Config = {
  serviceName?: string;
  debug?: boolean;
  redactHeaders?: string[];
  redactRequestBody?: string[];
  redactResponseBody?: string[];
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  tags?: string[];
  serviceVersion?: string;
  monitorAxios?: AxiosInstance;
};

export function ReportError(
  error: any,
  reqContext?: any,
  nextAsyncLocalStorage?: any
) {
  const outsideContextMsg =
    "APIToolkit: ReportError used outside of the APIToolkit middleware's scope. Use the APIToolkitClient.ReportError instead, if you're not in a web context.";

  const resp = normaliseError(error);
  if (!resp) {
    return;
  }
  const [nError, _internalFrames] = resp;
  const atError = buildError(nError);
  if (reqContext) {
    const ctx = reqContext.get();
    if (!ctx || !ctx.apitoolkitData) {
      console.warn(outsideContextMsg);
      return;
    }
    const errList = ctx.apitoolkitData?.errors || [];
    errList.push(atError);
    ctx.apitoolkitData.errors = errList;
  } else {
    let as = asyncLocalStorage;
    if (nextAsyncLocalStorage) {
      as = nextAsyncLocalStorage;
    }
    if (as.getStore() == null) {
      console.warn(outsideContextMsg);
      return;
    }
    const errList: ATError[] = as.getStore()!.get("AT_errors");
    errList.push(atError);
    as.getStore()!.set("AT_errors", errList);
  }
}

// Recursively unwraps an error and returns the original cause.
function rootCause(err: Error): Error {
  let cause = err;
  while (cause && (cause as any).cause) {
    cause = (cause as any).cause;
  }
  return cause;
}

function normaliseError(maybeError: any): [Error, number] | undefined {
  let error;
  let internalFrames = 0;

  // In some cases:
  //
  //  - the promise rejection handler (both in the browser and node)
  //  - the node uncaughtException handler
  //
  // We are really limited in what we can do to get a stacktrace. So we use the
  // tolerateNonErrors option to ensure that the resulting error communicates as
  // such.
  switch (typeof maybeError) {
    case "string":
    case "number":
    case "boolean":
      error = new Error(String(maybeError));
      internalFrames += 1;
      break;
    case "function":
      return;
    case "object":
      if (maybeError !== null && isError(maybeError)) {
        error = maybeError;
      } else if (maybeError !== null && hasNecessaryFields(maybeError)) {
        error = new Error(maybeError.message || maybeError.errorMessage);
        error.name = maybeError.name || maybeError.errorClass;
        internalFrames += 1;
      } else {
        // unsupported error
        return;
      }
      break;
    default:
    // unsupported errors found
  }

  return [error, internalFrames];
}

const hasNecessaryFields = (error: any): boolean =>
  (typeof error.name === "string" || typeof error.errorClass === "string") &&
  (typeof error.message === "string" || typeof error.errorMessage === "string");

function isError(value: any): boolean {
  switch (Object.prototype.toString.call(value)) {
    case "[object Error]":
      return true;
    case "[object Exception]":
      return true;
    case "[object DOMException]":
      return true;
    default:
      return value instanceof Error;
  }
}

function buildError(err: Error): ATError {
  const errType = err.constructor.name;

  const rootError = rootCause(err);
  const rootErrorType = rootError.constructor.name;

  return {
    when: new Date().toISOString(),
    error_type: errType,
    message: err.message,
    root_error_type: rootErrorType,
    root_error_message: rootError.message,
    stack_trace: err.stack ?? "",
  };
}
