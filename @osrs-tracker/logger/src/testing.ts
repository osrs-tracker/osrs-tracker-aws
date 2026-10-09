import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach } from 'vitest';

/** A pino destination that keeps every line it's sent, parsed. */
export function collectLines(): { write: (line: string) => void; lines: Record<string, unknown>[]; raw: string[] } {
  const raw: string[] = [];
  const lines: Record<string, unknown>[] = [];
  return {
    raw,
    lines,
    write: (line) => {
      raw.push(line);
      lines.push(JSON.parse(line));
    },
  };
}

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

/** Serves `app` on a free port and returns its base URL. Closed after each test. */
export async function listen(app: express.Express): Promise<string> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
