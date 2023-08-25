import { parseHiscoreString } from '@osrs-tracker/hiscores';
import { Context, ScheduledEvent } from 'aws-lambda';
import { Agent } from 'https';
import { discordAlert } from './utils/discord-alert';
import { getHiscore } from './utils/osrs-api';

const agent = new Agent({
  keepAlive: true,
  maxFreeSockets: 5,
  maxSockets: 50,
  timeout: 30000,
});

export const handler = async (event: ScheduledEvent, context: Context) => {
  const testUsernames = ['ToxSick', 'Lynx Titan', 'Hey Jase'];

  await Promise.all(
    testUsernames.map(async (username) => {
      const hiscore = await getHiscore(agent, username);

      if (!hiscore) {
        await discordAlert(
          'Error validating `parseHiscoreString()`',
          `Failed to fetch hiscore for "${username}".`,
          context,
        );
        throw new Error(`Failed to fetch hiscore for ${username}`);
      }

      try {
        parseHiscoreString(hiscore, new Date());
      } catch (e) {
        await discordAlert(
          'Error validating `parseHiscoreString()`',
          `Failed to parse hiscore for "${username}".`,
          context,
        );
        throw new Error(`Failed to parse hiscore for ${username}`);
      }

      console.log('Successfully parsed hiscore for:', username);
    }),
  );

  return context.logStreamName;
};
