import { HiscoreResult } from '@osrs-tracker/hiscores';
import { createHiscoreLayout } from '@osrs-tracker/models';
import { MongoClient } from 'mongodb';
import { setTimeout as sleep } from 'node:timers/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MU } from './mongo.utils';
import { fetchHiscore } from './player.utils';
import { scrapeMessage } from './scrape-message';

// the outcomes it shares with the handler (failed, not found, paused, layouts failing to store) are in index.spec.ts
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => {}) }));
vi.mock('./player.utils', () => ({ fetchHiscore: vi.fn() }));
vi.mock('./mongo.utils', () => ({
  MU: {
    ensureHiscoreLayouts: vi.fn(),
    hiscoreEntryBulkWriteOp: vi.fn((username: string) => ({ updateOne: { filter: { username }, update: [] } })),
    recordHiscoreNotFound: vi.fn(),
  },
}));

const client = {} as MongoClient;

const found: HiscoreResult = {
  status: 'found',
  hiscore: { skills: { Overall: { rank: 1, level: 2277, xp: 4_600_000_000 } }, activities: {} },
  layout: { skills: ['Overall'], activities: [] },
};

describe('scrapeMessage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(MU.ensureHiscoreLayouts).mockResolvedValue();
    vi.mocked(fetchHiscore).mockResolvedValue(found);
  });

  it('staggers the hiscore requests 2 s apart', async () => {
    await scrapeMessage(client, { usernames: ['alice', 'bob', 'carol'], scrapingOffset: 0 });

    expect(vi.mocked(sleep).mock.calls).toEqual([[2000], [4000]]);
    expect(fetchHiscore).toHaveBeenCalledTimes(3);
  });

  it("stores the found players' layouts, and builds their entries with one scrape time and the message's offset", async () => {
    const scraped = await scrapeMessage(client, { usernames: ['alice', 'bob'], scrapingOffset: 7 });

    const [[, layouts]] = vi.mocked(MU.ensureHiscoreLayouts).mock.calls;
    const scrapeTime = layouts[0].since;
    const layout = createHiscoreLayout(found.layout, scrapeTime);
    const entries = vi.mocked(MU.hiscoreEntryBulkWriteOp).mock.calls.map(([, { d, o, l }]) => ({ d, o, l }));
    expect(layouts).toEqual([layout, layout]);
    expect(entries).toEqual([
      { d: scrapeTime, o: 7, l: layout._id },
      { d: scrapeTime, o: 7, l: layout._id },
    ]);
    expect(scraped.bulkUpdateUsernames).toEqual(['alice', 'bob']);
    expect(scraped.bulkUpdateOps).toHaveLength(2);
  });

  it('keeps the found hiscores as fetched, with the scrape time, for the scrape results queue', async () => {
    vi.mocked(fetchHiscore).mockImplementation(async (username) =>
      username === 'bob' ? { status: 'notFound', httpStatus: 404 } : found,
    );

    const scraped = await scrapeMessage(client, { usernames: ['alice', 'bob'], scrapingOffset: 7 });

    const [[, [layout]]] = vi.mocked(MU.ensureHiscoreLayouts).mock.calls;
    expect(scraped.scrapedAt).toEqual(layout.since);
    expect(scraped.found).toEqual([{ username: 'alice', hiscore: found.hiscore, layout: found.layout }]);
  });

  it('drops the found hiscores with their entries when the layouts failed to store', async () => {
    vi.mocked(MU.ensureHiscoreLayouts).mockRejectedValue(new Error('Atlas unreachable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const scraped = await scrapeMessage(client, { usernames: ['alice'], scrapingOffset: 0 });

    expect(scraped.found).toEqual([]);
    expect(scraped.failedUsernames).toEqual(['alice']);
  });

  it('stores no layouts when no player was found', async () => {
    vi.mocked(fetchHiscore).mockResolvedValue({ status: 'failed', reason: 'HTTP 503' });

    const scraped = await scrapeMessage(client, { usernames: ['alice'], scrapingOffset: 0 });

    expect(MU.ensureHiscoreLayouts).not.toHaveBeenCalled();
    expect(scraped.failedUsernames).toEqual(['alice']);
  });
});
