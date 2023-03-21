import { Context, ScheduledEvent } from 'aws-lambda';
import { Agent } from 'https';
import { AuthMechanism, MongoClient } from 'mongodb';
import { fetchItems, fetchLatest } from './utils/item.utils';
import { MU } from './utils/mongo.utils';

const client = new MongoClient(process.env.MONGODB_URI!, {
  auth: {
    username: process.env.AWS_ACCESS_KEY_ID,
    password: process.env.AWS_SECRET_ACCESS_KEY,
  },
  authMechanism: AuthMechanism.MONGODB_AWS,
  authSource: '$external',
});

const agent = new Agent({
  keepAlive: true,
  maxFreeSockets: 5,
  maxSockets: 5,
  timeout: 30000,
});

export const handler = async (_event: ScheduledEvent, context: Context) => {
  const startFetching = process.hrtime();

  const [items, latest] = await Promise.all([
    fetchItems(agent),
    fetchLatest(agent),
    MU.col(client).createIndex({ id: 1 }, { unique: true }),
  ]);

  console.info(
    `Fetched ${items.length} items in ${Math.trunc(
      process.hrtime(startFetching)[0] * 1000 + process.hrtime(startFetching)[1] / 1000000,
    )}ms.`,
  );

  const startUpserting = process.hrtime();

  const upsertedItemCount = await MU.upsertItems(
    client,
    items.map((item) => ({ ...item, latest: latest[item.id] })),
  );

  console.info(
    `Upserted ${upsertedItemCount} items in ${Math.trunc(
      process.hrtime(startUpserting)[0] * 1000 + process.hrtime(startUpserting)[1] / 1000000,
    )}ms.`,
  );

  if (upsertedItemCount === 0) throw Error('No items processed');

  return context.logStreamName;
};
