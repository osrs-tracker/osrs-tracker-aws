import { Context, ScheduledEvent } from 'aws-lambda';
import { startOfDay, subDays } from 'date-fns';
import { AuthMechanism, MongoClient } from 'mongodb';
import { discordAlert } from './utils/discord-alert';
import { MU } from './utils/mongo.utils';

const client = new MongoClient(process.env.MONGODB_URI!, {
  auth: {
    username: process.env.AWS_ACCESS_KEY_ID,
    password: process.env.AWS_SECRET_ACCESS_KEY,
  },
  authMechanism: AuthMechanism.MONGODB_AWS,
  authSource: '$external',
});

export const handler = async (event: ScheduledEvent, context: Context) => {
  const maxAgeInDays = Number(process.env.MAX_AGE_IN_DAYS);

  const result = await MU.col(client).updateMany(
    {},
    { $pull: { hiscoreEntries: { date: { $lt: subDays(startOfDay(new Date()), maxAgeInDays) } } } },
  );

  if (result.modifiedCount === 0) {
    await discordAlert('Error cleaning hiscores', `No hiscores older than ${maxAgeInDays} days were found.`, context);
    throw new Error(`No hiscores older than ${maxAgeInDays} days were found.`);
  }

  console.log(`Cleaned hiscores older than ${maxAgeInDays} days for ${result.modifiedCount} players.`);

  return context.logStreamName;
};
