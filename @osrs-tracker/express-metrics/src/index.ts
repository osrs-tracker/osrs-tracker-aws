export { metricsMiddleware } from './metrics-middleware.js';
export type { MetricsMiddlewareOptions } from './metrics-middleware.js';

// For each app's own metrics, registered on the same registry
export { Counter, Gauge, Histogram, register, Registry, Summary } from '@prometheus-io/client';
