import { Registry } from '@prometheus-io/client';
import type { Request, RequestHandler, Response, Router } from 'express';
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
/**
 * Records `http_request_duration_seconds` (labels `status_code`, `method`, `path`) and `up` for every request, with the
 * same names, labels and buckets as express-prom-bundle, and serves them from `metricsApp`.
 */
export declare function metricsMiddleware({ metricsApp, normalizePath, metricsPath, registry, defaultMetrics, }: MetricsMiddlewareOptions): RequestHandler;
