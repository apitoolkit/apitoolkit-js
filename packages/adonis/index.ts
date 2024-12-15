export { configure } from './configure.js'
import { ReportError, observeAxios as as, AxiosConfig } from '@apitoolkit/common'
export { defineConfig } from './src/define_config.js'
import APIToolkitMiddleware from './src/middleware/apitoolkit_middleware.js'
import { HttpContext } from '@adonisjs/core/http'

export function observeAxios(config: AxiosConfig) {
  config.requestContext = HttpContext
  return as(config)
}

export function reportError(err: any) {
  ReportError(err, HttpContext)
}

const APIToolkit = APIToolkitMiddleware
export default APIToolkit
