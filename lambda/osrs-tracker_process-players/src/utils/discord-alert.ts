import type { Context } from 'aws-lambda/handler';
import { discordAlertNeverRejects } from '@lambda/shared/discord-alert';
import { env } from '../env';

/**
 * Sends a Discord alert listing the players. Never rejects: most alerts are sent after the scrape results, where a throw
 * would make Lambda retry the event and requeue its failed players a second time, so a failed alert is only logged.
 */
export async function discordAlert(title: string, players: string[], context: Context, summary = 'Failed to update') {
  let description = `${summary} ${players.length} player${players.length > 1 ? 's:' : ':'}\n`;
  description += players.map((username) => `- ${username}`).join('\n');

  await discordAlertNeverRejects(env.WEBHOOK_URL, title, description, context);
}
