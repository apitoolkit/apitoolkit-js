import { ReportError, asyncLocalStorage } from "./main";
import { AxiosConfig, observeAxios as oa } from "./axios";
export function observeAxios(config: AxiosConfig) {
  config.nextAsyncLocalStorage = asyncLocalStorage;
  return oa(config);
}

export function reportError(error: Error) {
  return ReportError(error, undefined, asyncLocalStorage);
}

export { withAPItoolkitAppRouter, withAPItoolkitPagesRouter } from "./main";
