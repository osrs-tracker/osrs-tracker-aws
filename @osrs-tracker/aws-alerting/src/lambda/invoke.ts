import { Lambda } from '@aws-sdk/client-lambda';
import { DiscordAlert as DiscordAlertData } from '../models/discord-alert';

export function discordAlert(data: DiscordAlertData): Promise<any> {
  return new Lambda().invoke({
    FunctionName: 'osrs-tracker_discord-alert',
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify({
      body: JSON.stringify({
        ...data,
        timestamp: data.timestamp?.toISOString(),
      }),
    }),
  });
}
