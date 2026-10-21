import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { HiscoresResultMessage, PlayerCountResultMessage } from '@osrs-tracker/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scrapeResultGroupId, sendScrapeResult } from './sqs.utils';

const queueUrl = 'https://sqs.invalid/osrs-tracker_scrape-results.fifo';

const hiscores: HiscoresResultMessage = {
  v: 1,
  type: 'hiscores',
  scrapedAt: '2026-10-21T13:00:02.000Z',
  scrapingOffset: -4,
  found: [
    {
      username: 'alice',
      hiscore: { skills: { Overall: { rank: 1, level: 2277, xp: 4_600_000_000 } }, activities: {} },
      layout: { skills: ['Overall'], activities: [] },
    },
  ],
  notFound: [],
};

const playerCount: PlayerCountResultMessage = {
  v: 1,
  type: 'playerCount',
  playerCount: { date: '2026-10-21T13:00:00.000Z', total: 3, members: 2, f2p: 1, worlds: 1, byLocation: { 0: 3 } },
};

describe('scrapeResultGroupId', () => {
  it('groups hiscores by offset and the player counts in one group', () => {
    expect(scrapeResultGroupId(hiscores)).toBe('offset:-4');
    expect(scrapeResultGroupId({ ...hiscores, scrapingOffset: 0 })).toBe('offset:0');
    expect(scrapeResultGroupId(playerCount)).toBe('playerCount');
  });
});

describe('sendScrapeResult', () => {
  const send = vi.fn();
  const client = { send } as unknown as SQSClient;

  beforeEach(() => {
    send.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('sends the message as JSON in its group, without a deduplication ID, and returns true', async () => {
    send.mockResolvedValue({ MessageId: '1' });

    expect(await sendScrapeResult(client, queueUrl, hiscores)).toBe(true);
    expect(send).toHaveBeenCalledExactlyOnceWith(expect.any(SendMessageCommand));
    expect(send.mock.calls[0][0].input).toEqual({
      QueueUrl: queueUrl,
      MessageGroupId: 'offset:-4',
      MessageBody: JSON.stringify(hiscores),
    });
  });

  it('never rejects: returns false and logs when the call fails', async () => {
    const error = new Error('Access denied');
    send.mockRejectedValue(error);

    expect(await sendScrapeResult(client, queueUrl, playerCount)).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Failed to send a playerCount result to the scrape results queue', {
      MessageGroupId: 'playerCount',
      error,
    });
  });
});
