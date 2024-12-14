import { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { v4 as uuidv4 } from 'uuid'
import { trace } from '@opentelemetry/api'

import config from '@adonisjs/core/services/config'
import {
  ReportError,
  observeAxiosGlobal,
  observeAxios,
  Config,
  AxiosConfig,
  setAttributes,
  asyncLocalStorage,
} from '@apitoolkit/common'

const defaultConfig = {
  debug: false,
}

export default class APIToolkitMiddleware {
  #config: Config
  constructor() {
    const configs = config.get('apitoolkit', defaultConfig) as Config
    if (configs.debug) {
      console.log('apitoolkit:  initialized successfully')
    }
    if (configs.monitorAxios) {
      observeAxiosGlobal(configs.monitorAxios, configs)
    }
    this.#config = configs
  }
  observeAxios(axiosConfig: AxiosConfig) {
    return observeAxios(axiosConfig)
  }

  middleware() {
    const conf = this.#config
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    class Middleware {
      #config: Config
      constructor() {
        this.#config = conf
      }
      async handle({ request, response }: HttpContext, next: NextFn) {
        asyncLocalStorage.run(new Map(), async () => {
          const store = asyncLocalStorage.getStore()
          const msgId = uuidv4()
          const span = trace
            .getTracer(this.#config.serviceName || '')
            .startSpan('apitoolkit-http-span')

          if (store) {
            store.set('AT_msg_id', msgId)
            store.set('AT_errors', [])
          }
          if (this.#config?.debug) {
            console.log('APIToolkit: adonisjs middleware called')
          }
          const reqBody = this.getSafeBody(request.body())
          let serverError = null
          try {
            await next()
          } catch (error) {
            serverError = error
            ReportError(serverError)
            throw error
          } finally {
            const respBody = this.getSafeBody(response.getBody())
            const statusCode = serverError !== null ? 500 : response.response.statusCode
            setAttributes(
              span,
              request.hostname() || '',
              statusCode,
              request.qs(),
              request.params(),
              request.headers(),
              response.getHeaders(),
              request.method(),
              request.url(true),
              msgId,
              request.ctx?.route?.pattern || '',
              reqBody,
              respBody,
              this.#config,
              'JsAdonis',
              undefined
            )
          }
        })
      }
      getSafeBody(rqb: any): string {
        let result = ''
        if (typeof rqb === 'object') {
          try {
            result = JSON.stringify(rqb)
          } catch (error) {
            result = String(rqb)
          }
        } else {
          result = String(result)
        }
        return result
      }
    }
    return Promise.resolve({ default: Middleware })
  }
}
