/// <reference types="node" />
import { PubSub } from '@google-cloud/pubsub';
import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';
import { Payload } from './payload';
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
export declare const asyncLocalStorage: AsyncLocalStorage<Map<string, any>>;
export declare class APIToolkit {
    #private;
    publishMessage: (payload: Payload) => void;
    constructor(pubsub: PubSub | undefined, topicName: string, project_id: string, config: Config);
    static NewClient(config: Config): APIToolkit;
    close(): Promise<void>;
    static getClientMetadata(rootURL: string, apiKey: string): ClientMetadata;
    expressMiddleware(req: Request, res: Response, next: NextFunction): void;
}
export declare function ReportError(error: any): Promise<never> | undefined;
export default APIToolkit;
