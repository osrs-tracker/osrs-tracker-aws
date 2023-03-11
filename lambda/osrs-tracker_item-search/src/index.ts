import { APIGatewayEvent, APIGatewayProxyResultV2 } from 'aws-lambda';
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

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResultV2> => {
  const query = event.pathParameters?.query;

  // Check if query is provided
  if (!query) return { statusCode: 400, body: 'No id provided' };

  // Search for item
  const items = await MU.searchItems(client, query);

  if (!items.length) return { statusCode: 204, body: `No items found matching "${query}"` };

  // Return player info
  return {
    statusCode: 200,
    headers: {
      'Cache-Control': 'max-age=86400',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(items),
  };
};
