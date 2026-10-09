import { DiscordWebhook, DiscordWebhookMessage } from '@osrs-tracker/discord-webhooks';
import { Context } from 'aws-lambda/handler';
import { DRY_RUN, logDryRun } from './dry-run.utils';

/**
 * Sends a red Discord alert to `webhookUrl`, linking to this invocation's logs and the function's monitoring tab. A
 * non-2xx response (e.g. a revoked webhook) is logged, not thrown; a failed request rejects. Code that must not throw,
 * such as process-players after its bulk writes, uses `discordAlertNeverRejects` instead.
 */
export async function discordAlert(
  webhookUrl: string,
  title: string,
  description: string,
  context: Context,
): Promise<void> {
  const region = context.invokedFunctionArn.split(':')[3];

  const message: DiscordWebhookMessage = {
    embeds: [
      {
        title,
        description,
        url: `https://console.aws.amazon.com/cloudwatch/home?region=${region}#logEventViewer:group=/aws/lambda/${context.functionName};stream=${context.logStreamName}`,
        author: {
          name: context.functionName,
          url: `https://console.aws.amazon.com/lambda/home?region=${region}#/functions/${context.functionName}?tab=monitoring`,
        },
        color: 0xff0000,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (DRY_RUN) return logDryRun('send Discord alert', message);

  // fetch resolves on 4xx/5xx too (e.g. a revoked webhook), so check the status or the alert is lost without a trace
  const response: Response = await DiscordWebhook.dispatch(message, { webhookUrl });
  if (!response.ok) console.error(`Failed to send Discord alert: HTTP ${response.status}`);
}

/** `discordAlert` that never rejects: a failed request is only logged. */
export async function discordAlertNeverRejects(
  webhookUrl: string,
  title: string,
  description: string,
  context: Context,
): Promise<void> {
  await discordAlert(webhookUrl, title, description, context).catch((e) =>
    console.error('Failed to send Discord alert', e),
  );
}
