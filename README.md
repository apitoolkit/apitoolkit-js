<div align="center">

![APItoolkit's Logo](https://github.com/apitoolkit/.github/blob/main/images/logo-white.svg?raw=true#gh-dark-mode-only)
![APItoolkit's Logo](https://github.com/apitoolkit/.github/blob/main/images/logo-black.svg?raw=true#gh-light-mode-only)

## Javascript SDKs Shared Code

[![APItoolkit SDK](https://img.shields.io/badge/APItoolkit-SDK-0068ff?logo=javascript)](https://github.com/topics/apitoolkit-sdk) [![](https://img.shields.io/npm/v/apitoolkit-js.svg?logo=npm)](https://npmjs.com/package/apitoolkit-js) [![](https://img.shields.io/npm/dw/apitoolkit-js
)](https://npmjs.com/package/apitoolkit-js) [![Join Discord Server](https://img.shields.io/badge/Chat-Discord-7289da)](https://discord.gg/dEB6EjQnKB) [![APItoolkit Docs](https://img.shields.io/badge/Read-Docs-0068ff)](https://apitoolkit.io/docs/sdks/nodejs?utm_source=github-sdks) 

APItoolkit is an end-to-end API and web services management toolkit for engineers and customer support teams. To integrate your Javascript application with APItoolkit, you can use any of the [existing NodeJS framework SDKs](https://apitoolkit.io/docs/sdks/nodejs?utm_source=github-sdks) or directly use this `apitoolkit-js` package (the shared code for all the Javascript SDKs) to monitor incoming traffic, aggregate the requests, and then deliver them to the APItoolkit's servers.

</div>

---

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Contributing and Help](#contributing-and-help)
- [License](#license)

---

## Installation

Kindly run the command below to install this package:

```sh
npm install apitoolkit-js
```

## Configuration

Next, initialize APItoolkit in your application's entry point (e.g., `index.js`), like so:

```js
import { APIToolkit, ReportError, observeAxios } from "apitoolkit-js";

const apiToolkitClient = APIToolkit.NewClient({
  apiKey: "{ENTER_YOUR_API_KEY_HERE}",
  debug: false,
  tags: ["environment: production", "region: us-east-1"],
  serviceVersion: "v2.0",
});

...
```

> [!NOTE]
> 
>  - The `{ENTER_YOUR_API_KEY_HERE}` demo string should be replaced with the [API key](https://apitoolkit.io/docs/dashboard/settings-pages/api-keys?utm_source=github-sdks) generated from the APItoolkit dashboard.
> - To learn more configuration options (redacting fields, error reporting, outgoing requests, etc.), please read any of the [NodeJS SDK documentation](https://apitoolkit.io/docs/sdks/nodejs?utm_source=github-sdks).

## Contributing and Help

To contribute to the development of this PROJECT or request help from the community and our team, kindly do any of the following:
- Read our [Contributors Guide](https://github.com/apitoolkit/.github/blob/main/CONTRIBUTING.md).
- Join our community [Discord Server](https://discord.gg/dEB6EjQnKB).
- Create a [new issue](https://github.com/apitoolkit/apitoolkit-js/issues/new/choose) in this repository.

## License

This repository is published under the [MIT](LICENSE) license.

---

<div align="center">
    
<a href="https://apitoolkit.io?utm_source=github-sdks" target="_blank" rel="noopener noreferrer"><img src="https://github.com/apitoolkit/.github/blob/main/images/icon.png?raw=true" width="40" /></a>

</div>

