import { AsyncLocalStorage } from "async_hooks";
import { Payload, ATError } from "./payload";

export type Config = {
    apiKey: string;
    rootURL?: string;
    debug?: boolean;
    redactHeaders?: string[];
    redactRequestBody?: string[];
    redactResponseBody?: string[];
    clientMetadata?: ClientMetadata;
    serviceVersion?: string;
    tags?: string[];
};

type ClientMetadata = {
    project_id: string;
    pubsub_project_id: string;
    topic_id: string;
    pubsub_push_service_account: any;
};

export const asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

export declare class APIToolkit {
    #private;
    publishMessage: (payload: Payload) => void;
}
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
    const errList: ATError[] = asyncLocalStorage.getStore()!.get('AT_errors');
    errList.push(atError);
    asyncLocalStorage.getStore()!.set('AT_errors', errList);
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
        case 'string':
        case 'number':
        case 'boolean':
            error = new Error(String(maybeError));
            internalFrames += 1;
            break;
        case 'function':
            return;
        case 'object':
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
    (typeof error.name === 'string' || typeof error.errorClass === 'string') &&
    (typeof error.message === 'string' || typeof error.errorMessage === 'string');

function isError(value: any): boolean {
    switch (Object.prototype.toString.call(value)) {
        case '[object Error]':
            return true;
        case '[object Exception]':
            return true;
        case '[object DOMException]':
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
        stack_trace: err.stack ?? '',
    };
}
