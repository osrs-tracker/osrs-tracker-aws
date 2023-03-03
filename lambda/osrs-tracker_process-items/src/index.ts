import { SQSEvent } from 'aws-lambda';
import { Agent } from 'https';
import { AuthMechanism, MongoClient } from 'mongodb';
import { processItems } from './utils/item.utils';
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
  MU.db(client).stats(); // prestart connection to MongoDB in background

  const pages = event.Records.flatMap((record) => JSON.parse(record.body!));
  const processItemJobs = pages.map((page) => processItems(client, agent, page));

  const processedItemCount = await Promise.all(processItemJobs).then((results) =>
    results.reduce((acc, val) => (acc += val), 0),
  );

  if (processedItemCount === 0) {
    throw Error('No items processed');
  }

  console.log(`Processed ${processedItemCount} items`);

  return context.logStreamName;
};
