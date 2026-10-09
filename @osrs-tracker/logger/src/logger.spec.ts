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

  describe('an error with a cause', () => {
    const errorField = (error: unknown): string => {
      const destination = collectLines();
      createLogger({ destination }).error(error, 'Failed');
      expect(destination.raw).toHaveLength(1);
      expect(destination.raw[0]!.trimEnd()).not.toContain('\n');
      return destination.lines[0]!.error as string;
    };

    it('follows its stack with each cause, Node style', () => {
      const reason = new Error('connect ECONNREFUSED 127.0.0.1:27017');
      const error = new TypeError('fetch failed', { cause: new Error('Connection lost', { cause: reason }) });

      expect(errorField(error)).toBe(
        `${error.stack}\nCaused by: ${(error.cause as Error).stack}\nCaused by: ${reason.stack}`,
      );
    });

    it.each([
      ['a string', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_CONNECT_TIMEOUT'],
      ['an object, as JSON', { code: 'ECONNRESET' }, '{"code":"ECONNRESET"}'],
    ])('writes a non-Error cause, %s', (_, cause, text) => {
      const error = new Error('fetch failed', { cause });

      expect(errorField(error)).toBe(`${error.stack}\nCaused by: ${text}`);
    });

    it('stops at a cycle', () => {
      const first = new Error('first');
      const second = new Error('second', { cause: first });
      first.cause = second;

      expect(errorField(first)).toBe(`${first.stack}\nCaused by: ${second.stack}\nCaused by: [circular] Error: first`);
    });

    it('stops 5 causes deep', () => {
      let error = new Error('cause 0');
      for (let i = 1; i <= 7; i++) error = new Error(`cause ${i}`, { cause: error });

      const text = errorField(error);
      expect(text).toContain('Error: cause 2\n');
      expect(text).not.toContain('Error: cause 1');
      expect(text).toMatch(/\nCaused by: \[left out, too deep\]$/);
    });

    it("writes each of an AggregateError's errors", () => {
      const ipv6 = new Error('connect ECONNREFUSED ::1:443');
      const ipv4 = new Error('connect ECONNREFUSED 127.0.0.1:443');
      const aggregate = new AggregateError([ipv6, ipv4]);
      const error = new TypeError('fetch failed', { cause: aggregate });

      expect(errorField(error)).toBe(
        `${error.stack}\nCaused by: ${aggregate.stack}\nError 1 of 2: ${ipv6.stack}\nError 2 of 2: ${ipv4.stack}`,
      );
    });
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
