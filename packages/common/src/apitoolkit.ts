import * as jsonpath from "jsonpath";
import { AsyncLocalStorage } from "async_hooks";
import { Exception, Span } from "@opentelemetry/api";
import { AxiosInstance } from "axios";
export { AxiosInstance } from "axios";
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
  config: Config,
  sdkType: `JsExpress` | `JsFastify` | `JsAdonis` | "JsAxiosOutgoing",
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
      "http.request.body": Buffer.from(
        redactFields(reqBody, config.redactRequestBody || [])
      ).toString("base64"),
      "http.response.body": Buffer.from(
        redactFields(respBody, config.redactRequestBody || [])
      ).toString("base64"),
      "apitoolkit.errors": JSON.stringify(
        asyncLocalStorage.getStore()?.get("AT_errors") || []
      ),
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

export function redactFields(body: string, fieldsToRedact: string[]): string {
  try {
    const bodyOB = JSON.parse(body);
    fieldsToRedact.forEach((path) => {
      jsonpath.apply(bodyOB, path, function () {
        return "[CLIENT_REDACTED]";
      });
    });
    return JSON.stringify(bodyOB);
  } catch (error) {
    return body;
  }
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

export const asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

export function ReportError(error: any) {
  if (asyncLocalStorage.getStore() == null) {
    console.log(
      "APIToolkit: ReportError used outside of the APIToolkit middleware's scope. Use the APIToolkitClient.ReportError instead, if you're not in a web context."
    );
    return Promise.reject(error);
  }

  const resp = normaliseError(error);
  if (!resp) {
    return;
  }

  const [nError, _internalFrames] = resp;
  const atError = buildError(nError);
  const errList: ATError[] = asyncLocalStorage.getStore()!.get("AT_errors");
  errList.push(atError);
  asyncLocalStorage.getStore()!.set("AT_errors", errList);
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
