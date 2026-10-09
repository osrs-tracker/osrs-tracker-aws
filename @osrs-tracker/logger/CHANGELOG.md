## v0.2.0 - 2026/10/09

Breaking: the `error` field's format and `responseTime`'s precision change.

- The `error` field is written by Node's `util.inspect` instead of by hand: the stack, then the error's own fields
  (`code`, `errno`, …), its cause chain as `[cause]: …` (was `Caused by: …`) and an `AggregateError`'s errors as
  `[errors]: [ … ]`, with cycles marked `[Circular *1]`. It stops 4 levels deep and at 10 items per array
  (`... 2 more items`), handles errors from another realm (a `vm` context), and no longer throws for an object without a
  prototype. A string is still written as is (Nest passes a stack as one), and a non-Error object as `inspect` writes it
  instead of as JSON.
- `requestLogger`'s `responseTime` is pino-http's own timing, in whole milliseconds (`12ms`, was `12.345ms`), and
  `logOutgoingRequests` rounds its own to whole milliseconds to match.

## v0.1.1 - 2026/10/09

- The `error` field follows the stack with the error's `cause` chain, Node style (`Caused by: ` and the cause's own
  stack, or a non-Error cause as text, JSON for an object), and an `AggregateError`'s errors (`Error 1 of 2: …`), up to
  5 deep and stopping at a cycle. undici's `TypeError: fetch failed` and MongoDB's errors keep the actual reason there.
- README: the Nest section links to osrs-tracker-api's `NestLogger` instead of a `LoggerService` sketch that tagged
  every line `lifecycle` and misread Nest's `(message, ...optionalParams)` arguments.

## v0.1.0 - 2026/10/09

- First release: `createLogger` (pino, one JSON line per log with `level` as Loki names it, an ISO `time`, `type`,
  `message`, and an error's stack as one string under `error`; `context` adds per-line fields such as the request ID),
  `requestLogger` (Express request log on pino-http, `type: 'incoming'`, with the fields the web and API servers logged
  through `morgan`, including `aborted` requests timed until the client closed the connection), `logOutgoingRequests`
  (`fetch` requests from undici's `diagnostics_channel`, `type: 'outgoing'`) and `requestLogLevel`. `LogType` lists
  `incoming`, `outgoing`, `lifecycle` and `uncaught`; an app adds its own with `LogType<'prerender'>`. Licensed under
  Apache-2.0.
