import {
  asyncLocalStorage,
  ReportError,
  setAttributes,
  Config,
} from "@apitoolkit/common";

import { v4 as uuidv4 } from "uuid";
import { trace } from "@opentelemetry/api";
import { Application, NextFunction, Request, Response } from "express";

function middleware(config?: Config) {
  if (!config) {
    config = {};
  }
  return function (req: Request, res: Response, next: NextFunction) {
    asyncLocalStorage.run(new Map(), () => {
      const store = asyncLocalStorage.getStore();
      const msg_id = uuidv4();
      const span = trace
        .getTracer(config.serviceName || "")
        .startSpan("apitoolkit-http-span");

      if (store) {
        store.set("apitoolkit-span", span);
        store.set("apitoolkit-msg-id", msg_id);
        store.set("AT_errors", []);
      }
      if (config.debug) {
        console.log("APIToolkit: expressMiddleware called");
      }

      let respBody: any = "";
      const oldSend = res.send;
      res.send = (val) => {
        if (config.captureResponseBody) {
          respBody = val;
        }
        return oldSend.apply(res, [val]);
      };

      const onRespFinished = (req: Request, res: Response) => () => {
        res.removeListener("close", onRespFinished(req, res));
        res.removeListener("error", onRespFinished(req, res));
        res.removeListener("finish", onRespFinished(req, res));
        try {
          const reqBody = getRequestBody(
            req,
            config.captureRequestBody || false
          );
          const url_path = getUrlPath(req);
          setAttributes(
            span,
            req.hostname,
            res.statusCode,
            req.query,
            req.params,
            req.headers,
            res.getHeaders(),
            req.method,
            req.url,
            msg_id,
            url_path,
            reqBody,
            respBody,
            config,
            "JsExpress",
            undefined
          );
        } catch (error) {
          if (config.debug) {
            console.log(error);
          }
        } finally {
        }
      };

      const onRespFinishedCB = onRespFinished(req, res);
      res.on("finish", onRespFinishedCB).on("error", onRespFinishedCB);
      next();
    });
  };
}

function errorMiddleware() {
  return function (
    err: Error,
    _req: Request,
    _res: Response,
    next: NextFunction
  ) {
    ReportError(err);
    next(err);
  };
}

function getRequestBody(req: Request, captureRequestBody: boolean): string {
  const reqBody = "";
  if (req.body && captureRequestBody) {
    try {
      if (req.is("multipart/form-data")) {
        if (req.file) {
          req.body[req.file.fieldname] = `[${req.file.mimetype}_FILE]`;
        } else if (req.files) {
          if (!Array.isArray(req.files)) {
            for (const file in req.files) {
              req.body[file] = (req.files[file] as any).map(
                (f: any) => `[${f.mimetype}_FILE]`
              );
            }
          } else {
            for (const file of req.files) {
              req.body[file.fieldname] = `[${file.mimetype}_FILE]`;
            }
          }
        }
      }
      return JSON.stringify(req.body);
    } catch {
      return String(req.body);
    }
  }
  return reqBody;
}

function getUrlPath(req: Request): string {
  let url_path = req.route?.path || "";
  if (url_path == "" && req.method.toLowerCase() !== "head") {
    url_path = findMatchedRoute(req.app, req.method, req.originalUrl);
  } else if (req.baseUrl && req.baseUrl != "") {
    if (req.originalUrl.startsWith(req.baseUrl)) {
      url_path = req.baseUrl + url_path;
    } else {
      url_path = findMatchedRoute(req.app, req.method, req.originalUrl);
    }
  }
  return url_path;
}

const findMatchedRoute = (
  app: Application,
  method: string,
  url: string
): string => {
  try {
    const path = url.split("?")[0];
    const stack = app._router.stack;
    let final_path = "";

    const gatherRoutes = (stack: any, build_path: string, path: string) => {
      for (const layer of stack) {
        if (layer.route) {
          if (
            path.startsWith(layer.path) &&
            layer.route.methods[method.toLowerCase()] &&
            (layer.path === path || layer.regex.test(path))
          ) {
            build_path += layer.route.path;
            final_path = build_path;
            return;
          }
        } else if (layer.name === "router" && layer.handle.stack) {
          if (path.startsWith(layer.path)) {
            build_path += transformPath(layer.params, layer.path);
            path = path.replace(layer.path, "");
            gatherRoutes(layer.handle.stack, build_path, path);
          }
        }
      }
    };
    gatherRoutes(stack, "", path);
    return final_path;
  } catch {
    return "";
  }
};

const reportError = ReportError;

function transformPath(params: Record<string, string>, path: string): string {
  let transformedPath = path;
  for (const [key, value] of Object.entries(params)) {
    const placeholder = `:${key}`;
    transformedPath = transformedPath.replace(value, placeholder);
  }
  return transformedPath;
}

export const APIToolkit = {
  middleware,
  errorMiddleware,
  reportError,
};
export default APIToolkit;
