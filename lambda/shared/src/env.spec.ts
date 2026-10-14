import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanLambdaEnv, nonEmptyStr, positiveInt } from './env';

// cleanLambdaEnv reads process.env; the shared variables are set in vitest.config.mts
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('nonEmptyStr', () => {
  it('accepts a string', () => {
    vi.stubEnv('TEST_VALUE', 'value');

    expect(cleanLambdaEnv({ TEST_VALUE: nonEmptyStr() }).TEST_VALUE).toBe('value');
  });

  it('rejects an empty string', () => {
    vi.stubEnv('TEST_VALUE', '');

    expect(() => cleanLambdaEnv({ TEST_VALUE: nonEmptyStr() })).toThrow('TEST_VALUE (invalid)');
  });
});

describe('positiveInt', () => {
  it.each([
    ['1', 1],
    ['25', 25],
  ])('accepts %j', (input, value) => {
    vi.stubEnv('TEST_VALUE', input);

    expect(cleanLambdaEnv({ TEST_VALUE: positiveInt() }).TEST_VALUE).toBe(value);
  });

  it.each(['0', '-1', '1.5', 'ten', ''])('rejects %j', (input) => {
    vi.stubEnv('TEST_VALUE', input);

    expect(() => cleanLambdaEnv({ TEST_VALUE: positiveInt() })).toThrow('TEST_VALUE (invalid)');
  });
});

describe('cleanLambdaEnv', () => {
  it('names every missing or invalid variable in one error, never a value', () => {
    vi.stubEnv('TEST_INVALID', 'secret-value');
    vi.stubEnv('TEST_MISSING', undefined);

    expect(() => cleanLambdaEnv({ TEST_INVALID: positiveInt(), TEST_MISSING: nonEmptyStr() })).toThrow(
      new Error('Invalid environment variables: TEST_INVALID (invalid), TEST_MISSING (missing)'),
    );
  });
});
