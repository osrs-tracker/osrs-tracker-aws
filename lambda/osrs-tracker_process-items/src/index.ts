import { SQSEvent } from 'aws-lambda';
import { Agent } from 'https';
import { AuthMechanism, MongoClient } from 'mongodb';
import { fetchItemsFromPage, upsertItems } from './utils/item.utils';
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
  maxFreeSockets: 10,
  maxSockets: 50,
  timeout: 30000,
});

// receive message event sqs
export const handler = async (event: SQSEvent, context: any) => {
  const pages = event.Records.flatMap((record) => JSON.parse(record.body!));

  // Ensure index is created before processing items, together with fetching items from pages
  const [_index, ...itemsFromPages] = await Promise.all([
    MU.col(client).createIndex({ id: 1 }, { unique: true }),
    ...pages.map((page) => fetchItemsFromPage(agent, page)),
  ]);

  // Process items in parallel and wait for all to finish
  const upsertItemsPerPageJobs = itemsFromPages.map((itemsFromPage) => upsertItems(client, itemsFromPage));
  const upsertedItemCount = await Promise.all(upsertItemsPerPageJobs).then((results) =>
    results.reduce((acc, val) => (acc += val), 0),
  );

  if (upsertedItemCount === 0) {
    throw Error('No items processed');
  }

  console.log(`Processed ${upsertedItemCount} items`);

  return context.logStreamName;
};
