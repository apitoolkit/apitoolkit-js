"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactFields = exports.redactHeaders = exports.buildPayload = void 0;
const jsonpath_1 = __importDefault(require("jsonpath"));
function buildPayload({ start_time, requestHeaders, responseHeaders, reqParams, reqQuery, reqBody, respBody, redactHeaderLists, redactRequestBody, redactResponseBody, service_version, errors, msg_id, parent_id, tags, project_id, host, method, status_code, raw_url, url_path, sdk_type, }) {
    const reqObjEntries = Object.entries(requestHeaders).map(([k, v]) => [
        k,
        Array.isArray(v) ? v : [v],
    ]);
    const reqHeaders = new Map(reqObjEntries);
    const resObjEntries = Object.entries(responseHeaders).map(([k, v]) => [
        k,
        Array.isArray(v) ? v : [v],
    ]);
    const resHeaders = new Map(resObjEntries);
    const queryObjEntries = Object.entries(reqQuery).map(([k, v]) => {
        if (typeof v === "string")
            return [k, [v]];
        return [k, v];
    });
    const queryParams = Object.fromEntries(queryObjEntries);
    const pathParams = reqParams ?? {};
    const payload = {
        duration: Number(process.hrtime.bigint() - start_time),
        host: host,
        method: method,
        path_params: pathParams,
        project_id: project_id,
        proto_minor: 1,
        proto_major: 1,
        query_params: queryParams,
        raw_url: raw_url,
        referer: requestHeaders.referer ?? "",
        request_body: Buffer.from(redactFields(reqBody, redactRequestBody)).toString("base64"),
        request_headers: redactHeaders(reqHeaders, redactHeaderLists),
        response_body: Buffer.from(redactFields(respBody, redactResponseBody)).toString("base64"),
        response_headers: redactHeaders(resHeaders, redactHeaderLists),
        sdk_type: sdk_type,
        status_code: status_code,
        timestamp: new Date().toISOString(),
        url_path: url_path,
        errors,
        service_version,
        tags,
        msg_id,
        parent_id,
    };
    return payload;
}
exports.buildPayload = buildPayload;
function redactHeaders(headers, headersToRedact) {
    const redactedHeaders = {};
    const headersToRedactLowerCase = headersToRedact.map((header) => header.toLowerCase());
    for (const [key, value] of headers) {
        const lowerKey = key.toLowerCase();
        const isRedactKey = headersToRedactLowerCase.includes(lowerKey) || lowerKey === "cookie";
        redactedHeaders[key] = isRedactKey ? ["[CLIENT_REDACTED]"] : value;
    }
    return redactedHeaders;
}
exports.redactHeaders = redactHeaders;
function redactFields(body, fieldsToRedact) {
    try {
        const bodyOB = JSON.parse(body);
        fieldsToRedact.forEach((path) => {
            jsonpath_1.default.apply(bodyOB, path, function () {
                return "[CLIENT_REDACTED]";
            });
        });
        return JSON.stringify(bodyOB);
    }
    catch (error) {
        return body;
    }
}
exports.redactFields = redactFields;
