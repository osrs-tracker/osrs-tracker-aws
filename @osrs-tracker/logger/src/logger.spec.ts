import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it } from 'vitest';
import { createLogger, requestLogLevel } from './logger';
import { collectLines } from './testing';

describe('createLogger', () => {
  it('writes level, time and type first, the message under message, and no pid or hostname', () => {
    const destination = collectLines();
    createLogger({ destination }).child({ type: 'lifecycle' }).info('Listening on port 8080');

    expect(destination.raw[0]).toMatch(/^\{"level":"info","time":"[^"]+","type":"lifecycle",/);
    expect(destination.lines[0]).toEqual({
      level: 'info',
      time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      type: 'lifecycle',
      message: 'Listening on port 8080',
    });
  });

  it.each([
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
    ['fatal', 'fatal'],
  ] as const)('names level %s as Loki does', (method, level) => {
    const destination = collectLines();
    createLogger({ destination })[method]('message');

    expect(destination.lines[0]!.level).toBe(level);
  });

  it('leaves out levels below level, info by default', () => {
    const destination = collectLines();
    createLogger({ destination }).debug('hidden');
    createLogger({ destination, level: 'debug' }).debug('shown');

    expect(destination.lines).toEqual([expect.objectContaining({ level: 'debug', message: 'shown' })]);
  });

  it.each([
    ['an error as the merge object', (logger: ReturnType<typeof createLogger>, e: Error) => logger.error(e, 'Failed')],
    [
      'an error under error',
      (logger: ReturnType<typeof createLogger>, e: Error) => logger.error({ error: e }, 'Failed'),
    ],
    ['an error under err', (logger: ReturnType<typeof createLogger>, e: Error) => logger.error({ err: e }, 'Failed')],
  ])('logs %s with its stack as one string, on one line', (_, log) => {
    const destination = collectLines();
    const error = new Error('Mongo is down');
    log(createLogger({ destination }), error);

    expect(destination.raw).toHaveLength(1);
    expect(destination.raw[0]!.trimEnd()).not.toContain('\n');
    const line = destination.lines[0]!;
    expect(line.message).toBe('Failed');
    expect(line.error ?? line.err).toBe(error.stack);
    expect(line.error ?? line.err).toContain('Error: Mongo is down\n    at ');
  });

  it('adds the context fields to every line, leaving out undefined ones', () => {
    const destination = collectLines();
    const page = new AsyncLocalStorage<string>();
    const logger = createLogger({ destination, context: () => ({ page: page.getStore() }) });

    page.run('/trackers/price/4151', () => logger.info('inside'));
    logger.info('outside');

    expect(destination.lines[0]).toMatchObject({ page: '/trackers/price/4151', message: 'inside' });
    expect(destination.lines[1]).not.toHaveProperty('page');
  });
});

describe('requestLogLevel', () => {
  it.each([
    [200, false, 'info'],
    [304, false, 'info'],
    [404, false, 'warn'],
    [500, false, 'error'],
    [200, true, 'warn'],
    [500, true, 'warn'],
  ])('logs status %i (aborted %s) at %s', (status, aborted, level) => {
    expect(requestLogLevel(status, aborted)).toBe(level);
  });
});
