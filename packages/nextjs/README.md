<p>
<img src="https://apitoolkit.io/assets/img/logo-full.svg" alt="APIToolkit" width="250px" />
</p>

APIToolkit NextJs Middleware is a middleware that can be used to monitor HTTP requests. It is provides additional functionalities on top of the open telemetry instrumentation which creates a custom span for each request capturing details about the request including request and response bodies.

### Installation

Run the following command to install the neccessary package from your projects root:

```sh
npm install --save apitoolkit-next @vercel/otel @opentelemetry/api
```

### Setup Open Telemetry

Setting up open telemetry allows you to send traces, metrics and logs to the APIToolkit platform.
Add the following environment variables to your `.env` file:

```sh
OTEL_EXPORTER_OTLP_ENDPOINT="http://otelcol.apitoolkit.io:4318"
OTEL_SERVICE_NAME="my-service" # Specifies the name of the service.
OTEL_RESOURCE_ATTRIBUTES="at-project-key=<YOUR_API_KEY>" # Adds your API KEY to the resource.
OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf" #Specifies the protocol to use for the OpenTelemetry exporter.
```

### Then add the following to your `intrumentation.ts|js` file:

You can create the `intrumentation.ts|js` in the `src` directory of your project or root directory if you're not using a `src` directory.

```js
import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel("<YOUR_PROJECT_NAME>");
}
```

### HTTP Requests Monitoring

After setting up open telemetry. You can monitor http requests using APIToolkit's next middleware, this allows you to monitor all your http requests. including headers, response time, response status code, request body, response body, etc.

To monitor http requests, wrap your routes with the `withAPItoolkitAppRouter` function if you're using the `app` router or `withAPItoolkitPagesRouter` if you're using the `pages` router.

#### Example App Router

```js
import { withAPItoolkitAppRouter } from "apitoolkit-next";
import { NextRequest, NextResponse } from "next/server";
async function handleRequest(req: NextRequest) {
  return NextResponse.json({ message: "hello world" });
}

// Optional configuration
const config = {
  captureResponseBody: true,
  serviceName: "my-service",
}
export const GET = withAPItoolkitAppRouter(handleRequest, config);

```

#### Example Pages Router

```js
import type { NextApiRequest, NextApiResponse } from "next";
import { withAPItoolkitPagesRouter } from "apitoolkit-next";

function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ message: "Hello from Next.js!" });
}

// Optional configuration
const config = {
  captureResponseBody: true,
  serviceName: "my-service",
}

export default withAPItoolkitPagesRouter(handler, config);
```

#### Quick overview of the configuration parameters

An object with the following optional fields can be passed to the middleware to configure it:

| Option                | Description                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `debug`               | Set to `true` to enable debug mode.                                                               |
| `serviceName`         | A defined string name of your application.                                                        |
| `tags`                | A list of defined tags for your services (used for grouping and filtering data on the dashboard). |
| `serviceVersion`      | A defined string version of your application (used for further debugging on the dashboard).       |
| `redactHeaders`       | A list of HTTP header keys to redact.                                                             |
| `redactResponseBody`  | A list of JSONPaths from the response body to redact.                                             |
| `redactRequestBody`   | A list of JSONPaths from the request body to redact.                                              |
| `captureRequestBody`  | Default `false`, set to `true` if you want to capture the request body.                           |
| `captureResponseBody` | Default `false`, set to `true` if you want to capture the response body.                          |

<br />

> [!IMPORTANT]
>
> To learn more configuration options (redacting fields, error reporting, outgoing requests, etc.) and complete integration guide, please read this [SDK documentation](https://apitoolkit.io/docs/sdks/nodejs/nextjs?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme).

```

```
