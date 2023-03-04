import { APIGatewayEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { differenceInHours } from 'date-fns';
import { Agent } from 'https';
import { AuthMechanism, MongoClient } from 'mongodb';
import { PlayerType } from './models/player.model';
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

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResultV2> => {
  const username = event.pathParameters?.username;

  // Check if username is provided
  if (!username) return { statusCode: 400, body: 'No username provided' };

  // Check if player is in database
  let player = await MU.getPlayer(client, username);

  // Refresh player info if player is not found or if player is not a normal player and has not been refreshed in the last 2 hours
  if (!player || (player.type !== PlayerType.Normal && differenceInHours(new Date(), player.lastModified) > 2)) {
    player = await refreshPlayerInfo(client, agent, username);

    // Player does not exist or is not in the hiscores yet
    if (!player) return { statusCode: 404, body: `Player "${username}" not found` };
  }

  // Return player info
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(player),
  };
};