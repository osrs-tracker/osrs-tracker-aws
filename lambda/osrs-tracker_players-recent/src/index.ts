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
  // create index on lastHiscoreFetch (if not exists)
  await MU.col(client).createIndex(
    { lastHiscoreFetch: -1 },
    { partialFilterExpression: { lastHiscoreFetch: { $exists: true } } },
  );

  // Check if player is in database
  const players = await MU.getLastFetchedPlayers(client, 5);

  // Return player info
  return {
    statusCode: 200,
    headers: {
      'Cache-Control': 'max-age=60', // cache for 1 minutes
    },
    body: JSON.stringify(players),
  };
};
