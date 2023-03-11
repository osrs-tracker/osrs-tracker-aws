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
  const username = event.pathParameters?.username;

  if (!username) return { statusCode: 400, body: 'No username provided' };

  // Get scraping offset and skip from query params (default to 0)
  const scrapingOffset = parseInt(event.queryStringParameters?.scrapingOffset ?? '0');
  const skip = parseInt(event.queryStringParameters?.skip ?? '0');

  // ensure index exists on username and scrapingOffset
  await MU.col(client).createIndex({ 'username': 1, 'hiscoreEntries.scrapingOffset': 1 }, { sparse: true });

  // Get player hiscores
  const hiscores = await MU.getPlayerHiscores(client, username, scrapingOffset, skip);

  // Return hiscore info
  return {
    statusCode: 200,
    headers: {
      'Cache-Control': 'max-age=3600',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(hiscores),
  };
};
