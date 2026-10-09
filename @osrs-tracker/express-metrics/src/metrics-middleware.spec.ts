import { afterEach, describe, expect, it } from 'vitest';
import { Registry } from '@prometheus-io/client';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { metricsMiddleware } from './metrics-middleware';

const servers: Server[] = [];

async function listen(app: express.Express): Promise<string> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Sends one request through an app with the middleware and returns the metrics app's `/metrics` response. */
async function scrape(options: { defaultMetrics?: boolean } = {}): Promise<Response> {
  const app = express();
  const metricsApp = express();
  app.use(
    metricsMiddleware({
      metricsApp,
      normalizePath: (req) => req.route?.path ?? 'unknown',
      ...options,
      registry: new Registry(),
    }),
  );
  app.get('/players/:username', (_req, res) => {
    res.status(201).send('ok');
  });

  const appUrl = await listen(app);
  const metricsUrl = await listen(metricsApp);

  expect((await fetch(`${appUrl}/players/Zezima`)).status).toBe(201);
  return fetch(`${metricsUrl}/metrics`);
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe('metricsMiddleware', () => {
  it('records requests with express-prom-bundle names, labels and buckets, plus up and default metrics', async () => {
    const response = await scrape();
    const text = await response.text();

    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(text).toContain(
      '# HELP http_request_duration_seconds duration histogram of http responses labeled with: status_code, method, path',
    );
    expect(text).toMatch(
      /^http_request_duration_seconds_bucket\{le="0.003",status_code="201",method="GET",path="\/players\/:username"\} \d+$/m,
    );
    expect(text).toContain(
      'http_request_duration_seconds_count{status_code="201",method="GET",path="/players/:username"} 1',
    );
    for (const le of ['0.03', '0.1', '0.3', '1.5', '10', '+Inf']) {
      expect(text).toContain(`http_request_duration_seconds_bucket{le="${le}",status_code="201"`);
    }
    expect(text).toContain('# HELP up 1 = up, 0 = not up');
    expect(text).toMatch(/^up 1$/m);
    expect(text).toContain('nodejs_eventloop_lag_seconds');
  });

  it('leaves out the default metrics when defaultMetrics is false', async () => {
    const text = await (await scrape({ defaultMetrics: false })).text();

    expect(text).toMatch(/^up 1$/m);
    expect(text).not.toContain('nodejs_eventloop_lag_seconds');
  });
});
