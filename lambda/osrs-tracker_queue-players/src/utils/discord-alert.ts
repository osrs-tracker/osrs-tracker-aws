import { DiscordWebhook } from '@osrs-tracker/discord-webhooks';
import { Context } from 'aws-lambda/handler';

export function discordAlert(title: string, errors: Error[], context: Context) {
  const region = context.invokedFunctionArn.split(':')[3];

  return DiscordWebhook.dispatch({
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
  });
}
