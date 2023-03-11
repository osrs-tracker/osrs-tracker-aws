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
  const id = Number(event.pathParameters?.id ?? -1);

  // Check if username is provided
  if (id === -1) return { statusCode: 400, body: 'No id provided' };

  // Ensure index is created before fetching item
  await MU.col(client).createIndex({ id: 1 }, { unique: true });

  // Check if item is in database
  const item = await MU.getItem(client, id);

  if (!item) return { statusCode: 404, body: `Item with id "${id}" not found` };

  // Return player info
  return {
    statusCode: 200,
    headers: {
      'Cache-Control': 'max-age=7200',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(item),
  };
};
