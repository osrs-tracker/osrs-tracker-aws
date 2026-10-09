import { Registry } from '@prometheus-io/client';
import type { Request, RequestHandler, Response, Router } from 'express';
export interface MetricsMiddlewareOptions {
    metricsApp: Pick<Router, 'get'>;
    normalizePath: (req: Request, res: Response) => string;
    metricsPath?: string;
    registry?: Registry;
    defaultMetrics?: boolean;
}
export declare function metricsMiddleware({ metricsApp, normalizePath, metricsPath, registry, defaultMetrics, }: MetricsMiddlewareOptions): RequestHandler;
