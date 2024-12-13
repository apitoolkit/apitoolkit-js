export { configure } from './configure.js'
export { ReportError as reportError, observeAxios } from '@apitoolkit/common'
export { defineConfig } from './src/define_config.js'
import APIToolkitMiddleware from './src/middleware/apitoolkit_middleware.js'
const APIToolkit = APIToolkitMiddleware
export default APIToolkit
