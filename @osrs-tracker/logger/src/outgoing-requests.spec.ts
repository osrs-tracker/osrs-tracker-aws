import express from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';
import { once } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger';
import { logOutgoingRequests } from './outgoing-requests';
import { collectLines, listen } from './testing';

describe('logOutgoingRequests', () => {
  const page = new AsyncLocalStorage<string>();
  const destination = collectLines();
  const lines = destination.lines;
  let received: () => void;
  let url: string;
  let stop: () => void;

  beforeAll(() => {
    stop = logOutgoingRequests({ logger: createLogger({ destination, context: () => ({ page: page.getStore() }) }) });
  });
  afterAll(() => stop());
  beforeEach(async () => {
    lines.splice(0);
    url = await listen(
      express()
        .get('/ok', (_req, res) => void res.send('ok'))
        .get('/fail', (_req, res) => void res.status(500).send('error'))
        .get('/slow', () => received()), // Never answers, like a Wiki that's down
    );
  });

  it.each([
    ['/ok', 'info', '200'],
    ['/fail', 'error', '500'],
  ])('logs a finished request to %s at %s, with the context it was made in', async (path, level, status) => {
    await page.run('/trackers/price/4151', async () => (await fetch(url + path)).text());

    await vi.waitFor(() => expect(lines).toHaveLength(1));
    expect(destination.raw.at(-1)).toMatch(/^\{"level":"\w+","time":"[^"]+","type":"outgoing",/);
    expect(lines[0]).toEqual({
      level,
      time: expect.any(String),
      type: 'outgoing',
      page: '/trackers/price/4151',
      status,
      method: 'GET',
      url: `${url}${path}`,
      responseTime: expect.stringMatching(/^\d+\.\d{3}ms$/),
    });
  });

  it('logs a cancelled request as a warning, without a status', async () => {
    const controller = new AbortController();
    const handled = new Promise<void>((resolve) => (received = resolve));
    const request = fetch(`${url}/slow`, { signal: controller.signal }).catch(() => undefined);
    await handled;

    controller.abort();
    await request;

    await vi.waitFor(() => expect(lines).toHaveLength(1));
    expect(lines[0]).toMatchObject({ level: 'warn', type: 'outgoing', aborted: true, url: `${url}/slow` });
    for (const field of ['status', 'page', 'error']) expect(lines[0]).not.toHaveProperty(field);
  });

  it('logs a network error as an error with its message', async () => {
    // A port nothing listens on
    const closed = createServer().listen(0);
    await once(closed, 'listening');
    const { port } = closed.address() as AddressInfo;
    await new Promise((resolve) => closed.close(resolve));

    await fetch(`http://127.0.0.1:${port}/unreachable`).catch(() => undefined);

    await vi.waitFor(() => expect(lines).toHaveLength(1));
    expect(lines[0]).toMatchObject({
      level: 'error',
      type: 'outgoing',
      error: `connect ECONNREFUSED 127.0.0.1:${port}`,
    });
    expect(lines[0]).not.toHaveProperty('status');
    expect(lines[0]).not.toHaveProperty('aborted');
  });

  it('stops logging once stopped', async () => {
    const otherLines = collectLines();
    logOutgoingRequests({ logger: createLogger({ destination: otherLines }) })();
    await (await fetch(`${url}/ok`)).text();

    await vi.waitFor(() => expect(lines).toHaveLength(1));
    expect(otherLines.lines).toHaveLength(0);
  });
});
