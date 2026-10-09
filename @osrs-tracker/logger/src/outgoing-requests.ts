import diagnosticsChannel from 'node:diagnostics_channel';
import type { Logger } from 'pino';
import { captureContext, requestLogLevel, type LogType } from './logger.js';

/** The fields of undici's request object that are logged, see https://undici.nodejs.org/#/docs/api/DiagnosticsChannel */
interface UndiciRequest {
  origin: string;
  path: string;
  method: string;
}

interface OutgoingRequest {
  start: number;
  context: Record<string, unknown>;
  status?: number;
}

export interface LogOutgoingRequestsOptions {
  /** From `createLogger`. */
  logger: Logger;
}

/**
 * Logs every request the process makes with `fetch` once it has finished, in the shape of the request log
 * (`type: 'outgoing'`), with the `context` fields of where it was made (e.g. the page whose render made it). A request
 * that was cancelled is a `warn` with `aborted: true` and no `status`, a network error an `error` with its message.
 * Returns a function that stops logging.
 */
export function logOutgoingRequests({ logger }: LogOutgoingRequestsOptions): () => void {
  const log = logger.child({ type: 'outgoing' satisfies LogType });
  const requests = new WeakMap<UndiciRequest, OutgoingRequest>();

  const finished = (request: UndiciRequest, error?: Error): void => {
    const outgoing = requests.get(request);
    if (!outgoing) return;
    requests.delete(request);

    const aborted = error?.name === 'AbortError';
    const level = error && !aborted ? 'error' : requestLogLevel(outgoing.status ?? 0, aborted);
    log[level]({
      // Read when the request was made: the async context it ran in may have ended by now
      ...outgoing.context,
      status: error ? undefined : outgoing.status?.toString(),
      aborted: aborted || undefined,
      method: request.method,
      url: request.origin + request.path,
      responseTime: (performance.now() - outgoing.start).toFixed(3) + 'ms',
      error: error && !aborted ? error.message : undefined,
    });
  };

  const onCreate = (message: unknown): void => {
    const { request } = message as { request: UndiciRequest };
    requests.set(request, { start: performance.now(), context: captureContext(logger) });
  };
  const onHeaders = (message: unknown): void => {
    const { request, response } = message as { request: UndiciRequest; response: { statusCode: number } };
    const outgoing = requests.get(request);
    if (outgoing) outgoing.status = response.statusCode;
  };
  // Published once the response body has been read, so `responseTime` includes the download
  const onTrailers = (message: unknown): void => finished((message as { request: UndiciRequest }).request);
  const onError = (message: unknown): void => {
    const { request, error } = message as { request: UndiciRequest; error: Error };
    finished(request, error);
  };

  const subscriptions = {
    'undici:request:create': onCreate,
    'undici:request:headers': onHeaders,
    'undici:request:trailers': onTrailers,
    'undici:request:error': onError,
  };
  for (const [channel, onMessage] of Object.entries(subscriptions)) diagnosticsChannel.subscribe(channel, onMessage);
  return () => {
    for (const [channel, onMessage] of Object.entries(subscriptions))
      diagnosticsChannel.unsubscribe(channel, onMessage);
  };
}
