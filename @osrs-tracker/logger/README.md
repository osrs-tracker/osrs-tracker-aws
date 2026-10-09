# @osrs-tracker/logger &middot; [![NPM package](https://img.shields.io/npm/v/@osrs-tracker/logger.svg)](https://www.npmjs.com/package/@osrs-tracker/logger) [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/main/LICENSE)

Structured JSON logs for the Express and Nest servers of [OSRS Tracker](https://osrs-tracker.freekmencke.com), on
[pino](https://getpino.io) and [pino-http](https://www.npmjs.com/package/pino-http). It replaces `morgan` and the
hand-rolled JSON lines, so both servers write the same fields for Loki:

- One JSON object per line, starting with `level` as Loki names it (`info`, `warn`, `error`), `time` as an ISO string
  and `type`.
- The message under `message`; an error with its stack under `error`, as one string.
- `type` says what the line is about: `incoming` (a request the server answered), `outgoing` (a request it made),
  `lifecycle` (startup and shutdown) or `uncaught` (an error that reached the error handler). An app can add its own.

## Install

```bash
npm install @osrs-tracker/logger
```

## Usage

### `createLogger({ context?, level?, destination? })`

The base pino logger. `context` returns fields for every line, e.g. the page being rendered or the request ID
(`undefined` ones are left out). `level` defaults to `info`, `destination` to stdout. Log through a child with a `type`,
so every line has one:

```ts
import { createLogger, type LogType } from '@osrs-tracker/logger';

type AppLogType = LogType<'prerender'>; // adds an app's own types

const logger = createLogger({ context: () => ({ page: renderedPage.getStore() }) });
const lifecycle = logger.child({ type: 'lifecycle' satisfies AppLogType });

lifecycle.info('Listening on port 8080');
lifecycle.error(error, 'Shutdown failed'); // or { error }
```

```json
{ "level": "info", "time": "2026-10-09T18:00:00.000Z", "type": "lifecycle", "message": "Listening on port 8080" }
```

### `requestLogger({ logger, route, fields? })` (Express)

Logs every request once it has finished, as `type: 'incoming'`:

```ts
app.use(
  requestLogger({
    logger,
    route: (req, res) => routeLabel(req, res), // keep it low-cardinality
    fields: (req, res) => ({ cache: res.getHeader('x-cache') }), // app extras
  }),
);
```

```json
{
  "level": "info",
  "time": "…",
  "type": "incoming",
  "status": "200",
  "method": "GET",
  "host": "…",
  "route": "/items/:id",
  "url": "/items/4151",
  "responseTime": "12.345ms",
  "userAgent": "…",
  "clientIp": "…",
  "referer": "…",
  "contentLength": "512",
  "cache": "HIT"
}
```

`requestLogLevel(status, aborted)` sets the level: 5xx `error`, 4xx `warn`, else `info`. A request the client closed
before the headers were sent is a `warn` with `aborted: true` and no `status`, timed until the connection closed.
`responseTime` runs until the response finished. `context` is read when the request starts, so its fields are on the
line even though it's written after the request's async context has ended.

### `logOutgoingRequests({ logger })`

Logs every request the process makes with `fetch` once its body has been read, as `type: 'outgoing'` (`status`,
`method`, `url`, `responseTime`), with the `context` fields of where it was made. A cancelled request is a `warn` with
`aborted: true` and no `status`; a network error is an `error` with its message under `error`. Call it once at startup;
it returns a function that stops logging.

```ts
logOutgoingRequests({ logger });
```

### Nest

Use `requestLogger` as the request log middleware, after the global `nestjs-cls` middleware so the request ID comes from
`context`:

```ts
import { createLogger, requestLogger } from '@osrs-tracker/logger';
import { ClsServiceManager } from 'nestjs-cls';

export const logger = createLogger({
  context: () => ({ requestId: ClsServiceManager.getClsService().getId() }),
});

// app.module.ts: consumer.apply(requestLogger({ logger, route: (req) => routeLabel(req) })).forRoutes('*')
```

For Nest's and the services' own lines, see osrs-tracker-api's
[`NestLogger`](https://github.com/osrs-tracker/osrs-tracker-api/blob/main/src/common/logger/nest-logger.ts): it extends
Nest's `ConsoleLogger` and overrides only `printMessages`, so Nest still parses the arguments and filters the levels,
and writes each line through a child of the logger with a `type` from its context (`lifecycle`, `uncaught` or `app`).
