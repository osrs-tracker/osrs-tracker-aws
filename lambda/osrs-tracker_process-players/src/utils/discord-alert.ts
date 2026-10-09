import { DiscordWebhook, DiscordWebhookMessage } from '@osrs-tracker/discord-webhooks';
import { Context } from 'aws-lambda/handler';
import { DRY_RUN, logDryRun } from './dry-run.utils';
import { env } from '../env';

/**
 * Sends a Discord alert. Never rejects: most alerts are sent after the bulk writes, where a throw would make SQS retry
 * the message and store duplicate hiscore entries, so a failed alert is only logged.
 */
export async function discordAlert(title: string, players: string[], context: Context, summary = 'Failed to update') {
  const region = context.invokedFunctionArn.split(':')[3];

  let description = `${summary} ${players.length} player${players.length > 1 ? 's:' : ':'}\n`;
  description += players.map((username) => `- ${username}`).join('\n');

  const message: DiscordWebhookMessage = {
    embeds: [
      {
        title,
        description,
        url: `https://console.aws.amazon.com/cloudwatch/home?region=${region}#logEventViewer:group=/aws/lambda/${context.functionName};stream=${context.logStreamName}`,
        author: {
          name: 'osrs-tracker_process-players',
          url: `https://console.aws.amazon.com/lambda/home?region=${region}#/functions/${context.functionName}?tab=monitoring`,
        },
        color: 0xff0000,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (DRY_RUN) return logDryRun('send Discord alert', message);

  await DiscordWebhook.dispatch(message, { webhookUrl: env.WEBHOOK_URL }).catch((e) =>
    console.error('Failed to send Discord alert', e),
  );
}
