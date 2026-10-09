import { DiscordWebhook, DiscordWebhookMessage } from '@osrs-tracker/discord-webhooks';
import { Context } from 'aws-lambda/handler';
import { DRY_RUN, logDryRun } from './dry-run.utils';
import { env } from '../env';

export async function discordAlert(title: string, errors: unknown[], context: Context) {
  const region = context.invokedFunctionArn.split(':')[3];

  const message: DiscordWebhookMessage = {
    embeds: [
      {
        title,
        description: `Error count: ${errors.length}`,
        url: `https://console.aws.amazon.com/cloudwatch/home?region=${region}#logEventViewer:group=/aws/lambda/${context.functionName};stream=${context.logStreamName}`,
        author: {
          name: 'osrs-tracker_queue-players',
          url: `https://console.aws.amazon.com/lambda/home?region=${region}#/functions/${context.functionName}?tab=monitoring`,
        },
        color: 0xff0000,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (DRY_RUN) return logDryRun('send Discord alert', message);

  // fetch resolves on 4xx/5xx too (e.g. a revoked webhook), so check the status or the alert is lost without a trace
  const response: Response = await DiscordWebhook.dispatch(message, { webhookUrl: env.WEBHOOK_URL });
  if (!response.ok) console.error(`Failed to send Discord alert: HTTP ${response.status}`);
}
