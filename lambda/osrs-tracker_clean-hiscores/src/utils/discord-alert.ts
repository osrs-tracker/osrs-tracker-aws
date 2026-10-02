import { DiscordWebhook, DiscordWebhookMessage } from '@osrs-tracker/discord-webhooks';
import { Context } from 'aws-lambda/handler';
import { DRY_RUN, logDryRun } from './dry-run.utils';

export function discordAlert(title: string, description: string, context: Context) {
  const region = context.invokedFunctionArn.split(':')[3];

  const message: DiscordWebhookMessage = {
    embeds: [
      {
        title,
        description,
        url: `https://console.aws.amazon.com/cloudwatch/home?region=${region}#logEventViewer:group=/aws/lambda/${context.functionName};stream=${context.logStreamName}`,
        author: {
          name: 'osrs-tracker_clean-hiscores',
          url: `https://console.aws.amazon.com/lambda/home?region=${region}#/functions/${context.functionName}?tab=monitoring`,
        },
        color: 0xff0000,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (DRY_RUN) return logDryRun('send Discord alert', message);

  return DiscordWebhook.dispatch(message);
}
