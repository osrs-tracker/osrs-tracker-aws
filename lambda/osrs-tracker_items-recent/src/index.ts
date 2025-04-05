import { APIGatewayEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { AuthMechanism, MongoClient } from 'mongodb';
import { MU } from './utils/mongo.utils';

const client = new MongoClient(process.env.MONGODB_URI!, {
  auth: {
    username: process.env.AWS_ACCESS_KEY_ID,
    password: process.env.AWS_SECRET_ACCESS_KEY,
  },
  authMechanism: AuthMechanism.MONGODB_AWS,
  authSource: '$external',
});

export const handler = async (event: APIGatewayEvent, _context: Context): Promise<APIGatewayProxyResultV2> => {
  // create index on lastFetch (if not exists)
  await MU.col(client).createIndex({ lastFetch: -1 }, { partialFilterExpression: { lastFetch: { $exists: true } } });

  // Check if item is in database
  const items = await MU.getLastFetchedItems(client, 5);

  // Return item info
  return {
    statusCode: 200,
    headers: {
      'Cache-Control': 'max-age=60', // cache for 1 minutes
    },
    body: JSON.stringify(items),
  };
};
