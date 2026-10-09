import { Context } from 'aws-lambda/handler';
import { DRY_RUN, logDryRun } from './dry-run.utils';

/** @see https://discord.com/developers/docs/resources/message#embed-object-embed-limits */
const DISCORD_DESCRIPTION_MAX_LENGTH = 4096;

/**
 * The part of Discord's execute-webhook body these alerts use: one embed.
 *
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
interface DiscordAlertMessage {
  embeds: {
    title: string;
    description: string;
    url: string;
    author: { name: string; url: string };
    color: number;
    timestamp: string;
  }[];
}

/**
 * Sends a red Discord alert to `webhookUrl`, linking to this invocation's logs and the function's monitoring tab. A
 * non-2xx response (e.g. a revoked webhook) is logged, not thrown; a failed or timed-out (5 s) request rejects. A
 * description over Discord's limit is truncated. Code that must not throw, such as process-players after its bulk
 * writes, uses `discordAlertNeverRejects` instead.
 */
export async function discordAlert(
  webhookUrl: string,
  title: string,
  description: string,
  context: Context,
): Promise<void> {
  const region = context.invokedFunctionArn.split(':')[3];

  // Discord rejects a longer embed description with HTTP 400, which would lose the whole alert
  if (description.length > DISCORD_DESCRIPTION_MAX_LENGTH)
    description = `${description.slice(0, DISCORD_DESCRIPTION_MAX_LENGTH - 1)}…`;

  const message: DiscordAlertMessage = {
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
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    // undici's own timeouts are 300 s; a stalled request must not hold the Lambda until it times out (process-players
    // would then be retried by SQS after its bulk writes, storing duplicate hiscore entries)
    signal: AbortSignal.timeout(5_000),
  });
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
