import { Context, ScheduledEvent } from 'aws-lambda';
import { startOfDay, subDays } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discordAlert } from '@lambda/shared/discord-alert';
import { env } from './env';
import { handler } from './index';
import { MU } from './utils/mongo.utils';

const client = vi.hoisted(() => ({ fake: 'MongoClient' }));
vi.mock('./utils/mongo.utils', () => ({
  MU: {
    client: () => client,
    dropUnusedScrapingOffsets: vi.fn(),
    pullHiscoreEntriesBefore: vi.fn(),
    deleteUnusedHiscoreLayouts: vi.fn(),
    deletePlayersWithoutEntries: vi.fn(),
    hasHiscoreEntriesSince: vi.fn(),
  },
}));
vi.mock('@lambda/shared/discord-alert', () => ({ discordAlert: vi.fn() }));

const NOW = new Date('2026-10-14T00:00:30Z');
const context = { logStreamName: 'stream' } as Context;
const run = () => handler({} as ScheduledEvent, context);

describe('handler', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(MU.dropUnusedScrapingOffsets).mockResolvedValue([]);
    vi.mocked(MU.pullHiscoreEntriesBefore).mockResolvedValue(0);
    vi.mocked(MU.deleteUnusedHiscoreLayouts).mockResolvedValue(0);
    vi.mocked(MU.deletePlayersWithoutEntries).mockResolvedValue(0);
    vi.mocked(MU.hasHiscoreEntriesSince).mockResolvedValue(true);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('runs the four clean-ups in order, then checks for recent entries', async () => {
    expect(await run()).toBe('stream');

    expect(MU.dropUnusedScrapingOffsets).toHaveBeenCalledExactlyOnceWith(client, subDays(NOW, 180), NOW);
    expect(MU.pullHiscoreEntriesBefore).toHaveBeenCalledExactlyOnceWith(
      client,
      subDays(startOfDay(NOW), env.MAX_AGE_IN_DAYS),
    );
    expect(MU.deleteUnusedHiscoreLayouts).toHaveBeenCalledExactlyOnceWith(client, NOW);
    expect(MU.deletePlayersWithoutEntries).toHaveBeenCalledExactlyOnceWith(client);
    expect(MU.hasHiscoreEntriesSince).toHaveBeenCalledExactlyOnceWith(client, subDays(NOW, 2));

    expect(MU.dropUnusedScrapingOffsets).toHaveBeenCalledBefore(vi.mocked(MU.pullHiscoreEntriesBefore));
    expect(MU.pullHiscoreEntriesBefore).toHaveBeenCalledBefore(vi.mocked(MU.deleteUnusedHiscoreLayouts));
    expect(MU.deleteUnusedHiscoreLayouts).toHaveBeenCalledBefore(vi.mocked(MU.deletePlayersWithoutEntries));
    expect(MU.deletePlayersWithoutEntries).toHaveBeenCalledBefore(vi.mocked(MU.hasHiscoreEntriesSince));
  });

  it("doesn't alert when a player has an entry from the last 2 days", async () => {
    await run();

    expect(discordAlert).not.toHaveBeenCalled();
  });

  it('alerts, then throws, when nothing was scraped in 2 days', async () => {
    vi.mocked(MU.hasHiscoreEntriesSince).mockResolvedValue(false);
    // settles a macrotask later: a handler that throws without awaiting it rejects before `alertSent`
    const alertSent = vi.fn();
    vi.mocked(discordAlert).mockImplementation(async () => {
      await new Promise((resolve) => setImmediate(resolve));
      alertSent();
    });

    const message = 'No hiscores were scraped in the last 2 days.';
    await expect(run()).rejects.toThrow(message);

    expect(discordAlert).toHaveBeenCalledExactlyOnceWith(env.WEBHOOK_URL, 'No hiscores scraped', message, context);
    expect(alertSent).toHaveBeenCalled();
    expect(MU.deletePlayersWithoutEntries).toHaveBeenCalledBefore(vi.mocked(discordAlert));
  });
});
