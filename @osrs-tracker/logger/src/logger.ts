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

/** How many causes (and errors of an `AggregateError`) deep `errorText` follows an error. */
const MAX_CAUSE_DEPTH = 5;

/**
 * An error's stack (or message) as one string, which stays on one line in the JSON output. Its `cause` chain follows,
 * each as `Caused by: ` and its own text, and an `AggregateError`'s errors as `Error 1 of 2: ` and so on.
 */
function errorText(error: unknown): string | undefined {
  if (error === undefined) return undefined;
  return describe(error, new Set(), 0);
}

function describe(error: unknown, seen: Set<unknown>, depth: number): string {
  if (!(error instanceof Error)) return valueText(error);
  if (seen.has(error)) return `[circular] ${error.name}: ${error.message}`;
  seen.add(error);

  let text = error.stack ?? `${error.name}: ${error.message}`;
  const nested = (label: string, inner: unknown): void => {
    text += `\n${label}: ` + (depth < MAX_CAUSE_DEPTH ? describe(inner, seen, depth + 1) : '[left out, too deep]');
  };
  if (error instanceof AggregateError && Array.isArray(error.errors))
    error.errors.forEach((inner, i, all) => nested(`Error ${i + 1} of ${all.length}`, inner));
  if (error.cause !== undefined) nested('Caused by', error.cause);
  return text;
}

/** A non-Error thrown or used as a cause: an object as JSON, anything else as `String` does. */
function valueText(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
