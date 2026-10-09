import { inspect } from 'node:util';
import { pino, stdTimeFunctions, type DestinationStream, type LevelWithSilent, type Logger } from 'pino';

/**
 * What a log line is about, so Loki queries can pick one kind (`| json | type="outgoing"`):
 * - `incoming`: a request the server answered (`requestLogger`)
 * - `outgoing`: a request the server made (`logOutgoingRequests`)
 * - `lifecycle`: startup and shutdown
 * - `uncaught`: an error that reached the app's error handler
 */
export const LOG_TYPES = ['incoming', 'outgoing', 'lifecycle', 'uncaught'] as const;

/** A line's `type`. An app adds its own with `LogType<'prerender'>`. */
export type LogType<Extra extends string = never> = (typeof LOG_TYPES)[number] | Extra;

/** The levels a request line is logged at, as Loki names them. */
export type RequestLogLevel = 'info' | 'warn' | 'error';

/** Fields added to every line, e.g. the request ID or the page being rendered. `undefined` ones are left out. */
export type LogContext = () => Record<string, unknown>;

export interface CreateLoggerOptions {
  /** Called for every line; its fields are added to it (pino's `mixin`). */
  context?: LogContext;
  /** The lowest level that's written. Defaults to `info`. */
  level?: LevelWithSilent;
  /** Where lines are written. Defaults to stdout. */
  destination?: DestinationStream;
}

const contextKey = Symbol('osrs-tracker.logContext');

/**
 * One JSON object per line: `level` as Loki names it (`info`, `warn`, `error`), `time` as an ISO string, the message
 * under `message` and an error with its stack under `error`, as one string. Log through a child with a `type`
 * (`logger.child({ type: 'lifecycle' })`), so every line has one.
 */
export function createLogger({ context, level = 'info', destination }: CreateLoggerOptions = {}): Logger {
  const logger = pino(
    {
      level,
      base: undefined,
      messageKey: 'message',
      errorKey: 'error',
      timestamp: stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      serializers: { error: errorText, err: errorText },
      mixin: context,
    },
    destination,
  );
  return Object.assign(logger, { [contextKey]: context });
}

/**
 * The `context` fields of `logger` right now. For a line written later, outside the async context it's about (a request
 * log written once the response has finished): pass them in its merge object, which takes precedence over `context`.
 */
export function captureContext(logger: Logger): Record<string, unknown> {
  return (logger as Logger & { [contextKey]?: LogContext })[contextKey]?.() ?? {};
}

/** 5xx is `error`; 4xx and aborted requests (no response) are `warn`; else `info`. */
export function requestLogLevel(status: number, aborted: boolean): RequestLogLevel {
  return aborted ? 'warn' : status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
}

/**
 * An error as Node writes it (`inspect`): its stack, its own fields (`code`, `errno`, …), its `cause` chain and an
 * `AggregateError`'s errors, with cycles marked. The limits keep a line bounded: 4 levels deep (causes included), 10
 * items per array, 2000 characters per string. One string, which stays on one line in the JSON output.
 */
function errorText(error: unknown): string | undefined {
  if (error === undefined) return undefined;
  // As is: inspect would quote it and escape its newlines, and Nest passes a stack as a string (`error(message, stack)`)
  if (typeof error === 'string') return error;
  return inspect(error, { depth: 4, breakLength: Infinity, maxArrayLength: 10, maxStringLength: 2000 });
}
