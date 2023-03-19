import { APIGatewayEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { addHours, differenceInHours, differenceInSeconds } from 'date-fns';
import { Agent } from 'https';
import { AuthMechanism, MongoClient } from 'mongodb';
import { MU } from './utils/mongo.utils';
import { refreshPlayerInfo } from './utils/player.utils';

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

export const handler = async (event: APIGatewayEvent, _context: Context): Promise<APIGatewayProxyResultV2> => {
  const username = (event.pathParameters?.username ?? '').trim().toLowerCase();

  // Check if username is provided
  if (!username.length) return { statusCode: 400, body: 'No username provided' };
  if (username.length > 12) return { statusCode: 400, body: 'Usernames must be between 1 and 12 characters long.' };

  const includeLatestHiscoreEntry = event.queryStringParameters?.hiscore === 'true';

  // create index on id (if not exists)
  await MU.col(client).createIndex({ username: 1 }, { unique: true });

  // Check if player is in database
  let player = await MU.getPlayer(client, username, includeLatestHiscoreEntry);

  // Refresh player info if player is not found or if player has not been refreshed in the last 2 hours
  if (!player || differenceInHours(new Date(), player.lastModified) > 2) {
    const refreshed = await refreshPlayerInfo(client, agent, username);

    // Player does not exist or is not in the hiscores yet
    if (!refreshed) return { statusCode: 404, body: `Player "${username}" not found` };

    // fetch refreshed player from database to get all fields
    player = await MU.getPlayer(client, username, includeLatestHiscoreEntry)!;
  }

  // Return player info
  return {
    statusCode: 200,
    headers: {
      'Cache-Control': 'max-age=' + Math.min(900, differenceInSeconds(addHours(player!.lastModified, 2), new Date())), // cache for 15 minutes or until next refresh
    },
    body: JSON.stringify(player),
  };
};
