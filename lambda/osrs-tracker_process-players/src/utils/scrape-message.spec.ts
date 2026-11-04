import { HiscoreResult } from '@osrs-tracker/hiscores';
import { setTimeout as sleep } from 'node:timers/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchHiscore } from './player.utils';
import { scrapeMessage } from './scrape-message';

// the outcomes it shares with the handler (failed, not found, a scrape that threw) are in index.spec.ts
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => {}) }));
vi.mock('./player.utils', () => ({ fetchHiscore: vi.fn() }));

const found: HiscoreResult = {
  status: 'found',
  hiscore: { skills: { Overall: { rank: 1, level: 2277, xp: 4_600_000_000 } }, activities: {} },
  layout: { skills: ['Overall'], activities: [] },
};

describe('scrapeMessage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchHiscore).mockResolvedValue(found);
  });

  it('staggers the hiscore requests 2 s apart', async () => {
    await scrapeMessage({ usernames: ['alice', 'bob', 'carol'], scrapingOffset: 0 });

    expect(vi.mocked(sleep).mock.calls).toEqual([[2000], [4000]]);
    expect(fetchHiscore).toHaveBeenCalledTimes(3);
  });

  it("fetches from the event's table, the main table when it has none", async () => {
    await scrapeMessage({ usernames: ['alice'], scrapingOffset: 0 });
    await scrapeMessage({ usernames: ['bob'], scrapingOffset: 0, table: 'hiscore_oldschool_hardcore_mains' });

    expect(vi.mocked(fetchHiscore).mock.calls).toEqual([
      ['alice', undefined],
      ['bob', 'hiscore_oldschool_hardcore_mains'],
    ]);
  });

  it('keeps the found hiscores as fetched and sorts the others into failed and not found', async () => {
    vi.mocked(fetchHiscore).mockImplementation(async (username) => {
      if (username === 'bob') return { status: 'notFound', httpStatus: 404 };
      if (username === 'carol') return { status: 'failed', reason: 'HTTP 503' };
      return found;
    });
    const before = Date.now();

    const scraped = await scrapeMessage({ usernames: ['alice', 'bob', 'carol'], scrapingOffset: 7 });

    expect(scraped).toEqual({
      scrapedAt: expect.any(Date),
      found: [{ username: 'alice', hiscore: found.hiscore, layout: found.layout }],
      failedUsernames: ['carol'],
      notFoundUsernames: ['bob'],
    });
    expect(scraped.scrapedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
