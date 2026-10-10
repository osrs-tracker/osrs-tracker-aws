import { Context, ScheduledEvent } from 'aws-lambda';
import { startOfDay, subDays } from 'date-fns';
import { discordAlert } from '@lambda/shared/discord-alert';
import { MU } from './utils/mongo.utils';
import { env } from './env';

const client = MU.client();

export const handler = async (event: ScheduledEvent, context: Context) => {
  const maxAgeInDays = env.MAX_AGE_IN_DAYS;

  const now = new Date();
  const modifiedCount = await MU.pullHiscoreEntriesBefore(client, subDays(startOfDay(now), maxAgeInDays));

  if (modifiedCount === 0) {
    await discordAlert(
      env.WEBHOOK_URL,
      'Error cleaning hiscores',
      `No hiscores older than ${maxAgeInDays} days were found.`,
      context,
    );
    throw new Error(`No hiscores older than ${maxAgeInDays} days were found.`);
  }

  console.log(`Cleaned hiscores older than ${maxAgeInDays} days for ${modifiedCount} players.`);

  // after the pull, since only pulled entries can leave a layout unused
  const deletedLayoutCount = await MU.deleteUnusedHiscoreLayouts(client, now);
  console.log(`Deleted ${deletedLayoutCount} unused hiscore layouts.`);

  return context.logStreamName;
};
