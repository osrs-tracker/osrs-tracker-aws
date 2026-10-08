import { describe, expect, it, jest } from '@jest/globals';
import { getHiscore, HiscoreFetch, HiscoreJson } from './hiscore-client';

const baseUrl = 'https://hiscores.example';

const hiscore: HiscoreJson = {
  name: 'lynx titan',
  skills: [{ id: 0, name: 'Overall', rank: 1, level: 2376, xp: 4_600_000_000 }],
  activities: [{ id: 0, name: 'Grid Points', rank: -1, score: -1 }],
};

function respond(status: number, body: unknown = hiscore) {
  return jest.fn<HiscoreFetch>(async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }));
}

describe('getHiscore', () => {
  it('returns found with the body', async () => {
    const result = await getHiscore({ baseUrl, username: 'lynx titan', fetch: respond(200) });
    expect(result).toEqual({ status: 'found', hiscore });
  });

  it('URL-encodes the name and defaults to the normal table', async () => {
    const fetch = respond(200);
    await getHiscore({ baseUrl, username: 'lynx titan', fetch });
    expect(fetch.mock.calls[0][0]).toBe(`${baseUrl}/m=hiscore_oldschool/index_lite.json?player=lynx%20titan`);
  });

  it('uses the given table', async () => {
    const fetch = respond(200);
    await getHiscore({ baseUrl, username: 'zezima', table: 'hiscore_oldschool_hardcore_ironman', fetch });
    expect(fetch.mock.calls[0][0]).toBe(
      `${baseUrl}/m=hiscore_oldschool_hardcore_ironman/index_lite.json?player=zezima`,
    );
  });

  it('sends no-cache and a timeout signal', async () => {
    const fetch = respond(200);
    await getHiscore({ baseUrl, username: 'zezima', fetch });
    const init = fetch.mock.calls[0][1];
    expect(init.headers).toEqual({ 'cache-control': 'no-cache' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([404, 400] as const)('returns notFound on HTTP %i', async (status) => {
    const result = await getHiscore({ baseUrl, username: 'zezima', fetch: respond(status) });
    expect(result).toEqual({ status: 'notFound', httpStatus: status });
  });

  it('returns failed on other non-2xx', async () => {
    const result = await getHiscore({ baseUrl, username: 'zezima', fetch: respond(503) });
    expect(result).toEqual({ status: 'failed', reason: 'HTTP 503' });
  });

  it.each([
    ['null', null],
    ['no skills', { name: 'zezima', activities: [] }],
    ['no activities', { name: 'zezima', skills: [] }],
    ['an HTML page', '<html></html>'],
  ])('returns failed on an unexpected body (%s)', async (_, body) => {
    const result = await getHiscore({ baseUrl, username: 'zezima', fetch: respond(200, body) });
    expect(result).toEqual({ status: 'failed', reason: 'unexpected body' });
  });

  it('returns failed when the body is not JSON', async () => {
    const fetch = jest.fn<HiscoreFetch>(async () => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    }));
    const result = await getHiscore({ baseUrl, username: 'zezima', fetch });
    expect(result).toEqual({ status: 'failed', reason: 'unexpected body' });
  });

  it('returns failed on a timeout', async () => {
    const fetch = jest.fn<HiscoreFetch>(
      (_, { signal }) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
    );
    const result = await getHiscore({ baseUrl, username: 'zezima', fetch, timeoutMs: 10 });
    expect(result).toEqual({ status: 'failed', reason: 'timed out after 10ms' });
  });

  it('returns failed on a network error', async () => {
    const fetch = jest.fn<HiscoreFetch>(async () => {
      throw new TypeError('fetch failed');
    });
    const result = await getHiscore({ baseUrl, username: 'zezima', fetch });
    expect(result).toEqual({ status: 'failed', reason: 'network error: fetch failed' });
  });
});
