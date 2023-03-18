import { PlayerType } from '@osrs-tracker/models';
import { APIGatewayEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { addHours, addWeeks, differenceInHours, differenceInSeconds, differenceInWeeks } from 'date-fns';
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

  // create index on id (if not exists)
  await MU.col(client).createIndex({ username: 1 }, { unique: true });

  // Check if player is in database
  let player = await MU.getPlayer(client, username);

  // Refresh player info if player is not found or if player is not a normal player and has not been refreshed in the last 2 hours
  if (
    !player || // try refresh player if not found in MongoDB
    (player.type !== PlayerType.Normal && differenceInHours(new Date(), player.lastModified) > 2) || // refresh non-normal players every 2 hours
    differenceInWeeks(new Date(), player.lastModified) >= 1 // refresh default players every week to be sure
  ) {
    const refreshed = await refreshPlayerInfo(client, agent, username);

    // Player does not exist or is not in the hiscores yet
    if (!refreshed) return { statusCode: 404, body: `Player "${username}" not found` };
  }

  // fetch player from database again to get extra fields like scrapingOffsets
  player = await MU.getPlayer(client, username);

  // Return player info
  return {
    statusCode: 200,
    headers: {
      'Cache-Control':
        player!.type === PlayerType.Normal
          ? 'max-age=' + differenceInSeconds(addWeeks(player!.lastModified, 1), new Date()) // cache for max a week if player is a normal player
          : 'max-age=' + differenceInSeconds(addHours(player!.lastModified, 2), new Date()), // cache for max 2 hours if player is not a normal player
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(player),
  };
};
