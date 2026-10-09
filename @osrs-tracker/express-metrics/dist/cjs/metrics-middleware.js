"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = metricsMiddleware;
const client_1 = require("@prometheus-io/client");
const on_finished_1 = __importDefault(require("on-finished"));
const CLIENT_CLOSED_REQUEST = 499;
function metricsMiddleware({ metricsApp, normalizePath, metricsPath = '/metrics', registry = client_1.register, defaultMetrics = true, }) {
    registry.clear();
    const httpDuration = new client_1.Histogram({
        name: 'http_request_duration_seconds',
        help: 'duration histogram of http responses labeled with: status_code, method, path',
        labelNames: ['status_code', 'method', 'path'],
        buckets: [0.003, 0.03, 0.1, 0.3, 1.5, 10],
        registers: [registry],
    });
    new client_1.Gauge({ name: 'up', help: '1 = up, 0 = not up', registers: [registry] }).set(1);
    if (defaultMetrics)
        (0, client_1.collectDefaultMetrics)({ register: registry });
    metricsApp.get(metricsPath, async (_req, res) => {
        res.set('Content-Type', registry.contentType);
        res.end(await registry.metrics());
    });
    return (req, res, next) => {
        const endTimer = httpDuration.startTimer();
        (0, on_finished_1.default)(res, () => endTimer({
            status_code: res.headersSent ? res.statusCode : CLIENT_CLOSED_REQUEST,
            method: req.method,
            path: normalizePath(req, res),
        }));
        next();
    };
}
