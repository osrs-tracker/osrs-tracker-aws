import { Context } from 'aws-lambda/handler';
import { discordAlertNeverRejects } from '../../../shared/src/discord-alert';

/**
 * Sends a Discord alert listing the players. Never rejects: most alerts are sent after the bulk writes, where a throw
 * would make SQS retry the message and store duplicate hiscore entries, so a failed alert is only logged.
 */
export async function discordAlert(title: string, players: string[], context: Context, summary = 'Failed to update') {
  let description = `${summary} ${players.length} player${players.length > 1 ? 's:' : ':'}\n`;
  description += players.map((username) => `- ${username}`).join('\n');

  await discordAlertNeverRejects(title, description, context);
}
