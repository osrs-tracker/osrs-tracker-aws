import { fetchWorldList, parseWorldList, WorldListCounts } from '@osrs-tracker/hiscores';
import type { Context, ScheduledEvent } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { sendScrapeResult } from '@lambda/shared/sqs.utils';
import { handler } from './index';

// the world list's request and parser are tested in @osrs-tracker/hiscores
vi.mock('@osrs-tracker/hiscores', () => ({ fetchWorldList: vi.fn(), parseWorldList: vi.fn() }));

vi.mock('@lambda/shared/sqs.utils', () => ({ sendScrapeResult: vi.fn() }));

const event = {} as ScheduledEvent;
const context = {
  functionName: 'osrs-tracker_record-player-count',
  invokedFunctionArn: 'arn:aws:lambda:eu-central-1:000000000000:function:osrs-tracker_record-player-count',
  logStreamName: 'test-stream',
} as Context;

const worldList = new Uint8Array([1, 2, 3]);
const counts: WorldListCounts = {
  total: 100_000,
  members: 80_000,
  f2p: 20_000,
  worlds: 180,
  byLocation: { '0': 60_000, '1': 40_000 },
};

describe('record-player-count handler', () => {
  let discord: MockInstance<typeof fetch>;

  beforeEach(() => {
    vi.mocked(fetchWorldList).mockResolvedValue(worldList);
    vi.mocked(parseWorldList).mockReturnValue(counts);
    vi.mocked(sendScrapeResult).mockReset().mockResolvedValue();
    // the alert's webhook is down too: the run must still fail with the original error
    discord = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Webhook down'));
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sends the parsed counts as a playerCount message, dated with the run as an ISO string', async () => {
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));

    await expect(handler(event, context)).resolves.toBe('test-stream');

    expect(parseWorldList).toHaveBeenCalledWith(worldList);
    expect(sendScrapeResult).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      'https://sqs.invalid/osrs-tracker_scrape-results.fifo',
      { v: 1, type: 'playerCount', playerCount: { ...counts, date: '2026-10-14T10:00:00.000Z' } },
    );
    expect(discord).not.toHaveBeenCalled();
  });

  it.each<[string, () => void, string, boolean]>([
    ['the request fails', () => vi.mocked(fetchWorldList).mockRejectedValue(new Error('HTTP 503')), 'HTTP 503', false],
    [
      "the list doesn't parse",
      () =>
        vi.mocked(parseWorldList).mockImplementation(() => {
          throw new Error('Truncated world list');
        }),
      'Truncated world list',
      false,
    ],
    [
      'it has 0 worlds',
      () => vi.mocked(parseWorldList).mockReturnValue({ ...counts, worlds: 0 }),
      'The world list has 0 worlds and 100000 players.',
      false,
    ],
    [
      'it has 0 players',
      () => vi.mocked(parseWorldList).mockReturnValue({ ...counts, total: 0, members: 0, f2p: 0 }),
      'The world list has 180 worlds and 0 players.',
      false,
    ],
    [
      "the queue doesn't take the message",
      () => vi.mocked(sendScrapeResult).mockRejectedValue(new Error('Access denied')),
      'Access denied',
      true,
    ],
  ])('alerts and rethrows the original error when %s', async (_, arrange, message, sent) => {
    arrange();

    await expect(handler(event, context)).rejects.toThrow(message);

    expect(discord).toHaveBeenCalledOnce();
    const [url, init] = discord.mock.calls[0];
    expect(url).toBe(process.env.WEBHOOK_URL);
    expect(JSON.parse(String(init?.body)).embeds[0]).toMatchObject({
      title: 'Player count not recorded',
      description: `Error: ${message}`,
    });
    expect(sendScrapeResult).toHaveBeenCalledTimes(sent ? 1 : 0);
  });
});
