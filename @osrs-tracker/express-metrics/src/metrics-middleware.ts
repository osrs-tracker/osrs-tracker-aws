import { collectDefaultMetrics, Gauge, Histogram, register, Registry } from '@prometheus-io/client';
import type { Request, RequestHandler, Response, Router } from 'express';
import onFinished from 'on-finished';

export interface MetricsMiddlewareOptions {
  /** Separate Express app (or router) that serves `GET <metricsPath>`, so the metrics aren't on the public port. */
  metricsApp: Pick<Router, 'get'>;
  /** The `path` label of a finished request, e.g. its route pattern. Keep it low-cardinality: no IDs or usernames. */
  normalizePath: (req: Request, res: Response) => string;
  /** Defaults to `/metrics`. */
  metricsPath?: string;
  /** Defaults to the global `register`. It is cleared first, so hot reloads don't register the metrics twice. */
  registry?: Registry;
  /** Node process metrics (event-loop lag, heap, GC, handles). Defaults to `true`. */
  defaultMetrics?: boolean;
}

/** The status of a request the client closed before a response was sent, as express-prom-bundle reported it. */
const CLIENT_CLOSED_REQUEST = 499;

/**
 * Records `http_request_duration_seconds` (labels `status_code`, `method`, `path`) and `up` for every request, with the
 * same names, labels and buckets as express-prom-bundle, and serves them from `metricsApp`.
 */
export function metricsMiddleware({
  metricsApp,
  normalizePath,
  metricsPath = '/metrics',
  registry = register,
  defaultMetrics = true,
}: MetricsMiddlewareOptions): RequestHandler {
  registry.clear();

  const httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'duration histogram of http responses labeled with: status_code, method, path',
    labelNames: ['status_code', 'method', 'path'] as const,
    buckets: [0.003, 0.03, 0.1, 0.3, 1.5, 10],
    registers: [registry],
  });

  new Gauge({ name: 'up', help: '1 = up, 0 = not up', registers: [registry] }).set(1);

  if (defaultMetrics) collectDefaultMetrics({ register: registry });

  metricsApp.get(metricsPath, async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  return (req, res, next) => {
    const endTimer = httpDuration.startTimer();

    onFinished(res, () =>
      endTimer({
        status_code: res.headersSent ? res.statusCode : CLIENT_CLOSED_REQUEST,
        method: req.method,
        path: normalizePath(req, res),
      }),
    );

    next();
  };
}
