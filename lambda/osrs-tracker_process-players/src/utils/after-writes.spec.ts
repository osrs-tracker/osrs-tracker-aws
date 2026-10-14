import { SQSClient } from '@aws-sdk/client-sqs';
import { PlayerScrapeMessageBody } from '@osrs-tracker/models';
import { Context } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessageBatch } from '@lambda/shared/sqs.utils';
import { afterWrites, ScrapeRun } from './after-writes';
import { discordAlert } from './discord-alert';

// the outcomes it shares with the handler (failed writes, rejected retries, paused players) are in index.spec.ts
vi.mock('@lambda/shared/sqs.utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@lambda/shared/sqs.utils')>()),
  sendMessageBatch: vi.fn(),
}));
vi.mock('./discord-alert', () => ({ discordAlert: vi.fn() }));

const sqsClient = {} as SQSClient;
const context = { logStreamName: 'log-stream' } as Context;

function run(overrides: Partial<ScrapeRun>): ScrapeRun {
  return {
    bulkWrites: [],
    failedMap: new Map(),
    notFoundUsernames: [],
    pausedUsernames: [],
    maxReceiveCount: 1,
    ...overrides,
  };
}

const usernames = (count: number, prefix: string) => Array.from({ length: count }, (_, i) => `${prefix}${i}`);

describe('afterWrites', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(sendMessageBatch).mockResolvedValue([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('requeues the failed players per scrapingOffset, at most 10 messages per SQS batch', async () => {
    // PLAYERS_PER_SQS_MESSAGE is 2: 21 players make 11 messages
    const failedMap = new Map([
      [0, usernames(21, 'a')],
      [1, ['b0']],
    ]);

    await afterWrites(sqsClient, run({ failedMap }), context);

    const batches = vi.mocked(sendMessageBatch).mock.calls.map(([, , batch]) => batch);
    const messages: PlayerScrapeMessageBody[] = batches.flat().map(({ MessageBody }) => JSON.parse(MessageBody!));
    expect(batches.map((batch) => batch.length)).toEqual([10, 2]);
    expect(messages.filter(({ scrapingOffset }) => scrapingOffset === 0).flatMap((m) => m.usernames)).toEqual(
      failedMap.get(0),
    );
    expect(messages.at(-1)).toEqual({ usernames: ['b0'], scrapingOffset: 1 });
  });

  it.each([
    [1, []],
    [2, [['Failed to process some players', ['alice']]]],
  ])('alerts on the failed players only on a redelivered message (receive count %i)', async (maxReceiveCount, sent) => {
    await afterWrites(sqsClient, run({ failedMap: new Map([[0, ['alice']]]), maxReceiveCount }), context);

    expect(vi.mocked(discordAlert).mock.calls.map(([title, players]) => [title, players])).toEqual(sent);
  });
});
