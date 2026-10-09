import express from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger';
import { requestLogger } from './request-logger';
import { collectLines, listen } from './testing';

/** Like the API's request ID: set by a middleware before the request logger, read through `context`. */
const requestId = new AsyncLocalStorage<string>();

async function serve() {
  const destination = collectLines();
  const logger = createLogger({ destination, context: () => ({ requestId: requestId.getStore() }) });
  let received!: () => void;
  const handled = new Promise<void>((resolve) => (received = resolve));

  const app = express()
    .use((_req, _res, next) => requestId.run('request-1', next))
    .use(
      requestLogger({
        logger,
        route: (req) => req.route?.path,
        fields: (_req, res) => ({ cache: res.getHeader('x-cache') }),
      }),
    )
    .get('/players/:username', (_req, res) => void res.set('x-cache', 'HIT').send('ok'))
    .get('/missing', (_req, res) => void res.status(404).send('not found'))
    .get('/fail', (_req, res) => void res.status(500).send('error'))
    .get('/slow', () => received()); // Never answers, like a page render the client gives up on

  return { lines: destination.lines, raw: destination.raw, handled, url: await listen(app) };
}

describe('requestLogger', () => {
  it('logs a completed request with the fields both apps log', async () => {
    const { lines, raw, url } = await serve();
    await (
      await fetch(`${url}/players/Zezima?x=1`, {
        headers: { 'user-agent': 'vitest', 'referer': 'https://example.com/' },
      })
    ).text();

    await vi.waitFor(() => expect(lines).toHaveLength(1));
    expect(raw[0]).toMatch(/^\{"level":"info","time":"[^"]+","type":"incoming",/);
    expect(lines[0]).toEqual({
      level: 'info',
      time: expect.any(String),
      type: 'incoming',
      requestId: 'request-1',
      status: '200',
      method: 'GET',
      host: expect.stringMatching(/^127\.0\.0\.1:\d+$/),
      route: '/players/:username',
      url: '/players/Zezima?x=1',
      responseTime: expect.stringMatching(/^\d+\.\d{3}ms$/),
      userAgent: 'vitest',
      clientIp: expect.stringMatching(/127\.0\.0\.1$/),
      referer: 'https://example.com/',
      contentLength: '2',
      cache: 'HIT',
    });
  });

  it.each([
    ['/missing', 'warn', '404'],
    ['/fail', 'error', '500'],
  ])('logs a completed request to %s at %s with its status', async (path, level, status) => {
    const { lines, url } = await serve();
    await (await fetch(url + path)).text();

    await vi.waitFor(() => expect(lines).toHaveLength(1));
    expect(lines[0]).toMatchObject({ level, status, type: 'incoming', url: path });
    expect(lines[0]).not.toHaveProperty('aborted');
    expect(lines[0]).not.toHaveProperty('error');
    expect(lines[0]).not.toHaveProperty('message');
  });

  it('logs a request the client aborted before the headers were sent as a warning, without a status', async () => {
    const { lines, handled, url } = await serve();
    const controller = new AbortController();

    const request = fetch(`${url}/slow`, { signal: controller.signal }).catch(() => undefined);
    await handled;
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await request;

    await vi.waitFor(() => expect(lines).toHaveLength(1));
    expect(lines[0]).toMatchObject({
      level: 'warn',
      type: 'incoming',
      aborted: true,
      requestId: 'request-1',
      url: '/slow',
      responseTime: expect.stringMatching(/^\d+\.\d{3}ms$/),
    });
    expect(Number.parseFloat(lines[0]!.responseTime as string)).toBeGreaterThanOrEqual(20);
    for (const field of ['status', 'contentLength', 'cache', 'message', 'error']) {
      expect(lines[0]).not.toHaveProperty(field);
    }
  });
});
