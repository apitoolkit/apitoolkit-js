import APIToolkitMiddleware from '../src/middleware/apitoolkit_middleware.js'
export { ReportError as reportError, observeAxios } from '@apitoolkit/common'
import { configProvider } from '@adonisjs/core'
import { RuntimeException } from '@poppinss/utils'
import type { ApplicationService } from '@adonisjs/core/types'
import { Config } from '@apitoolkit/common'

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    APIToolkit: any
  }
}

export default class APIToolkitProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('APIToolkit', async () => {
      const appConfigProvider = this.app.config.get('apitoolkit')
      const config = await configProvider.resolve<Config>(this.app, appConfigProvider)

      if (!config) {
        throw new RuntimeException(
          'Invalid config exported from "config/apitoolkit.ts" file. Make sure to use the defineConfig method'
        )
      }

      return new APIToolkitMiddleware()
    })
  }
}
