<div align="center">

![APItoolkit's Logo](https://github.com/apitoolkit/.github/blob/main/images/logo-white.svg?raw=true#gh-dark-mode-only)
![APItoolkit's Logo](https://github.com/apitoolkit/.github/blob/main/images/logo-black.svg?raw=true#gh-light-mode-only)

## AdonisJS SDK

[![APItoolkit SDK](https://img.shields.io/badge/APItoolkit-SDK-0068ff?logo=adonisjs)](https://github.com/topics/apitoolkit-sdk) [![](https://img.shields.io/npm/v/apitoolkit-adonis.svg?logo=npm)](https://npmjs.com/package/apitoolkit-adonis) [![](https://img.shields.io/npm/dw/apitoolkit-adonis)](https://npmjs.com/package/apitoolkit-adonis) [![Join Discord Server](https://img.shields.io/badge/Chat-Discord-7289da)](https://apitoolkit.io/discord?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme) [![APItoolkit Docs](https://img.shields.io/badge/Read-Docs-0068ff)](https://apitoolkit.io/docs/sdks/nodejs/adonisjs?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme)

APIToolkit Adonis Middleware is a middleware that can be used to monitor HTTP requests. It is provides additional functionalities on top of the open telemetry instrumentation which creates a custom span for each request capturing details about the request including request and response bodies.

</div>

---

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Contributing and Help](#contributing-and-help)
- [License](#license)

---

## Installation

Run the following command to install the adonis js package from your projects root:

```sh
npm install --save apitoolkit-adonis @opentelemetry/api @opentelemetry/auto-instrumentations-node
```

### Setup Open Telemetry

Setting up open telemetry allows you to send traces, metrics and logs to the APIToolkit platform.

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT="http://otelcol.apitoolkit.io:4317"
export OTEL_SERVICE_NAME="my-service" # Specifies the name of the service.
export OTEL_RESOURCE_ATTRIBUTES=at-project-key="<YOUR_API_KEY>" # Adds your API KEY to the resource.
export OTEL_EXPORTER_OTLP_PROTOCOL="grpc" #Specifies the protocol to use for the OpenTelemetry exporter.
export NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"

node ace run dev server.js # starting your adonis server
```

### HTTP Requests Monitoring

You can monitor http requests using APIToolkit's Adonis middleware, this allows you to monitor all your http requests. including headers, response time, response status code, request body, response body, etc.

First configure the `apitoolkit-adonis` sdk by running the following command:

```sh
node ace configure apitoolkit-adonis
```

Then, register the middleware by adding the `apitoolkit-adonis` client to your global middleware list in the `start/kernel.js|ts` file like so:

```js
import server from '@adonisjs/core/services/server'
import APIToolkit from 'apitoolkit-adonis'

const client = new APIToolkit()

server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('#middleware/force_json_response_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
  () => client.middleware(),
])
```

Then, create an `apitoolkit.js|ts` file in the `/conf` directory and export the `defineConfig` object with some properties like so:

```js
import { defineConfig } from 'apitoolkit-adonis'

export default defineConfig({
  captureRequestBody: true,
  captureResponseBody: true,
  serviceName: 'my-service',
})
```

<br />

> [!IMPORTANT]
>
> To learn more configuration options (redacting fields, error reporting, outgoing requests, etc.), please read this [SDK documentation](https://apitoolkit.io/docs/sdks/nodejs/adonisjs?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme).

## Contributing and Help

To contribute to the development of this SDK or request help from the community and our team, kindly do any of the following:

- Read our [Contributors Guide](https://github.com/apitoolkit/.github/blob/main/CONTRIBUTING.md).
- Join our community [Discord Server](https://apitoolkit.io/discord?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme).
- Create a [new issue](https://github.com/apitoolkit/apitoolkit-adonis/issues/new/choose) in this repository.

## License

This repository is published under the [MIT](LICENSE) license.

---

<div align="center">

<a href="https://apitoolkit.io?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme" target="_blank" rel="noopener noreferrer"><img src="https://github.com/apitoolkit/.github/blob/main/images/icon.png?raw=true" width="40" /></a>

</div>
