import type { Request, RequestHandler, Response } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { captureContext, requestLogLevel, type LogType } from './logger.js';

export interface RequestLoggerOptions {
  /** From `createLogger`. */
  logger: Logger;
  /** The `route` field of a finished request, e.g. its route pattern. */
  route: (req: Request, res: Response) => string | undefined;
  /** Extra fields for a finished request, e.g. a cache header (`cache: res.getHeader('x-cache')`). */
  fields?: (req: Request, res: Response) => Record<string, unknown>;
}

interface StartedRequest {
  start: number;
  context: Record<string, unknown>;
}

/**
 * Logs every request once it has finished (`type: 'incoming'`) at `requestLogLevel`. A request the client closed
 * before the headers were sent is a `warn` with `aborted: true` and no `status`, timed until the connection closed.
 */
export function requestLogger({ logger, route, fields }: RequestLoggerOptions): RequestHandler {
  const started = new WeakMap<Response, StartedRequest>();

  const line = (req: Request, res: Response): Record<string, unknown> => {
    // The client closed the connection before the headers were sent: there's no status, and nothing failed on our side
    const aborted = !res.headersSent;
    const { start, context } = started.get(res) ?? { start: performance.now(), context: {} };
    return {
      // Read when the request started: the async context it ran in has ended by now
      ...context,
      status: aborted ? undefined : String(res.statusCode),
      aborted: aborted || undefined,
      method: req.method,
      host: req.headers.host,
      route: route(req, res),
      url: req.originalUrl || req.url,
      responseTime: (performance.now() - start).toFixed(3) + 'ms',
      userAgent: req.headers['user-agent'],
      clientIp: req.ip ?? req.socket.remoteAddress,
      referer: req.headers.referer ?? req.headers.referrer,
      contentLength: aborted ? undefined : headerText(res.getHeader('content-length')),
      ...fields?.(req, res),
    };
  };

  const httpLogger = pinoHttp<Request, Response>({
    logger: logger.child({ type: 'incoming' satisfies LogType }),
    // Log only through the response line: no `req` or `reqId` bindings, and Express' `req.id` left alone
    quietResLogger: true,
    genReqId: (req) => req.id,
    customLogLevel: (_req, res) => requestLogLevel(res.statusCode, !res.headersSent),
    customSuccessObject: (req, res) => line(req, res),
    customErrorObject: (req, res) => line(req, res),
    customSuccessMessage: () => undefined as unknown as string,
    customErrorMessage: () => undefined as unknown as string,
  });

  return (req, res, next) => {
    started.set(res, { start: performance.now(), context: captureContext(logger) });
    httpLogger(req, res, next);
  };
}

function headerText(header: number | string | string[] | undefined): string | undefined {
  return Array.isArray(header) ? header.join(', ') : header?.toString();
}
