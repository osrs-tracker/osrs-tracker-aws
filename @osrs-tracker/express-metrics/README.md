# @osrs-tracker/express-metrics &middot; [![NPM package](https://img.shields.io/npm/v/@osrs-tracker/express-metrics.svg)](https://www.npmjs.com/package/@osrs-tracker/express-metrics) [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/main/LICENSE)

Prometheus HTTP metrics for the Express 5 apps of [OSRS Tracker](https://osrs-tracker.freekmencke.com), on
[`@prometheus-io/client`](https://www.npmjs.com/package/@prometheus-io/client) (the successor of `prom-client`). It
replaces `express-prom-bundle` and keeps its series unchanged:

- `http_request_duration_seconds`: a histogram with labels `status_code`, `method` and `path`, and buckets
  `0.003, 0.03, 0.1, 0.3, 1.5, 10`. A request the client closed before the response was sent gets status `499`.
- `up`: a gauge set to `1`.
- Node process metrics (event-loop lag, heap, GC, handles), unless `defaultMetrics: false`.

## Install

```bash
npm install @osrs-tracker/express-metrics
```

## Usage

```ts
import express from 'express';
import { metricsMiddleware } from '@osrs-tracker/express-metrics';

const app = express();
const metricsApp = express(); // served on a separate port

app.use(metricsMiddleware({ metricsApp, normalizePath: (req, res) => req.route?.path ?? 'unknown' }));

app.listen(8080);
metricsApp.listen(9100); // GET /metrics
```

Options: `metricsPath` (default `/metrics`), `registry` (default the global `register`, cleared first so hot reloads
don't register the metrics twice) and `defaultMetrics` (default `true`). Keep `normalizePath` low-cardinality: route
patterns, not usernames or IDs.

The package re-exports `register`, `Registry`, `Counter`, `Gauge`, `Histogram` and `Summary`, so an app can add its own
metrics to the same registry. Create them after `metricsMiddleware`, which clears the registry.
