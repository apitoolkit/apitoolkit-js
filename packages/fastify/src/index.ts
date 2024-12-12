import { v4 as uuidv4 } from "uuid";
import { FastifyInstance } from "fastify";
import {
  asyncLocalStorage,
  Config,
  ReportError,
  setAttributes,
} from "@apitoolkit/common";
import { trace } from "@opentelemetry/api";

class APIToolkit {
  #config: Config & { fastify: FastifyInstance };
  constructor(config: Config & { fastify: FastifyInstance }) {
    this.#config = config;
    this.initializeHooks = this.initializeHooks.bind(this);
  }
  static NewClient({
    fastify,
    redactHeaders = [],
    redactRequestBody = [],
    redactResponseBody = [],
    serviceVersion = undefined,
    serviceName = "",
    debug = false,
    tags = [],
    monitorAxios = undefined,
  }: Config & { fastify: FastifyInstance }) {
    return new APIToolkit({
      fastify,
      redactHeaders,
      redactRequestBody,
      redactResponseBody,
      serviceName,
      serviceVersion,
      tags,
      debug,
      monitorAxios,
    });
  }

  private getStringValue(val: unknown): string {
    if (!val) return "";
    if (typeof val === "string") {
      return val;
    } else if (Buffer.isBuffer(val)) {
      return val.toString();
    } else {
      try {
        return JSON.stringify(val);
      } catch (error) {
        return "";
      }
    }
  }
  private getQuery(query: unknown) {
    try {
      return { ...(query as any) };
    } catch (error) {
      return {};
    }
  }
  public reportError(err: Error) {
    ReportError(err);
  }

  public initializeHooks() {
    // if (this.#axios) {
    //   observeAxiosGlobal(
    //     this.#axios,
    //     undefined,
    //     this.#redactHeaders,
    //     this.#redactRequestBody,
    //     this.#redactResponseBody,
    //     this
    //   );
    // }
    this.#config.fastify.addHook("preHandler", (request, _reply, done) => {
      if (this.#config.debug) {
        console.log("apitoolkit: preHandler hook called");
      }

      asyncLocalStorage.run(new Map(), () => {
        try {
          const span = trace
            .getTracer(this.#config.serviceName || "")
            .startSpan("apitoolkit-http-span");

          asyncLocalStorage.getStore()!.set("AT_client", this);
          asyncLocalStorage.getStore()!.set("AT_span", span);
          asyncLocalStorage.getStore()!.set("AT_config", {
            tags: this.#config.tags,
            serviceVersion: this.#config.serviceVersion,
          });

          asyncLocalStorage.getStore()!.set("AT_errors", []);
          const msg_id: string = uuidv4();
          asyncLocalStorage.getStore()!.set("AT_msg_id", msg_id);
        } catch (error) {
          if (this.#config.debug) {
            console.log("apitoolkit: error in preHandler hook");
            console.log(error);
          }
        }
        done();
      });
    });

    this.#config.fastify.addHook("onError", async (_request, _reply, error) => {
      ReportError(error);
    });

    this.#config.fastify.addHook("onSend", async (request, reply, data) => {
      if (this.#config.debug) {
        console.log("apitoolkit:  onSend hook called");
      }
      try {
        const reqBody = this.getStringValue(request.body);
        const resBody = this.getStringValue(data);
        const reqObjEntries = Object.entries(request.headers).map(([k, v]) => {
          if (typeof v === "string") return [k, [v]];
          return [k, v];
        });
        const reqHeaders = Object.fromEntries(reqObjEntries);
        const resObjEntries = Object.entries(reply.getHeaders()).map(
          ([k, v]) => {
            if (typeof v === "string") return [k, [v]];
            return [k, v];
          }
        );
        const resHeaders = Object.fromEntries(resObjEntries);

        const query = this.getQuery(request.query);
        const queryObjEntries = Object.entries(query).map(([k, v]) => {
          if (typeof v === "string") return [k, [v]];
          return [k, v];
        });
        const errors = asyncLocalStorage.getStore()?.get("AT_errors") ?? [];
        const span = asyncLocalStorage.getStore()?.get("AT_span");
        const msg_id =
          asyncLocalStorage.getStore()?.get("AT_msg_id") ?? uuidv4();
        const queryParams = Object.fromEntries(queryObjEntries);
        const pathParams = request.params ?? {};
        setAttributes(
          span,
          request.hostname,
          reply.statusCode,
          queryParams,
          pathParams,
          reqHeaders,
          resHeaders,
          request.method,
          request.url,
          msg_id,
          request.routeOptions.url || "/",
          reqBody,
          resBody,
          this.#config,
          "JsFastify",
          undefined
        );
        return data;
      } catch (error) {
        return data;
      }
    });
  }
}
export { APIToolkit };
