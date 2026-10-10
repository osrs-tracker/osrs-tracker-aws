import { Context, ScheduledEvent } from 'aws-lambda';
import { startOfDay, subDays } from 'date-fns';
import { discordAlert } from '@lambda/shared/discord-alert';
import { MU } from './utils/mongo.utils';
import { env } from './env';

const client = MU.client();

/** Days without a lookup after which a player's scraping offset is dropped, together with its hiscore entries. */
const UNUSED_SCRAPING_OFFSET_DAYS = 180;

export const handler = async (event: ScheduledEvent, context: Context) => {
  const maxAgeInDays = env.MAX_AGE_IN_DAYS;

  const now = new Date();

  // first, so the pull and the layout and player clean-ups below also see the entries of the dropped offsets go
  const dropped = await MU.dropUnusedScrapingOffsets(client, subDays(now, UNUSED_SCRAPING_OFFSET_DAYS), now);
  console.log(
    `Dropped scraping offsets not looked up for ${UNUSED_SCRAPING_OFFSET_DAYS} days from ${dropped.length} players.`,
    dropped,
  );

  const modifiedCount = await MU.pullHiscoreEntriesBefore(client, subDays(startOfDay(now), maxAgeInDays));
  console.log(`Cleaned hiscores older than ${maxAgeInDays} days for ${modifiedCount} players.`);

  // after the pull, since only pulled entries can leave a layout unused
  const deletedLayoutCount = await MU.deleteUnusedHiscoreLayouts(client, now);
  console.log(`Deleted ${deletedLayoutCount} unused hiscore layouts.`);

  // a player whose last entry was just pulled hasn't been scraped or looked up for MAX_AGE_IN_DAYS
  const deletedPlayerCount = await MU.deletePlayersWithoutEntries(client);
  console.log(`Deleted ${deletedPlayerCount} players without hiscore entries.`);

  // Every night should age out a day of entries; none points at scraping that stopped. Checked last, so the clean-ups
  // above run either way
  if (modifiedCount === 0) {
    await discordAlert(
      env.WEBHOOK_URL,
      'Error cleaning hiscores',
      `No hiscores older than ${maxAgeInDays} days were found.`,
      context,
    );
    throw new Error(`No hiscores older than ${maxAgeInDays} days were found.`);
  }

  return context.logStreamName;
};
