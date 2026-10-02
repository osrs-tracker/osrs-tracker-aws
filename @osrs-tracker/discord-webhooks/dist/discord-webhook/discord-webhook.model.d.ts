import { RESTPostAPIWebhookWithTokenJSONBody } from 'discord-api-types/v10';
export interface DiscordWebhookOptions {
    webhookUrl: string;
}
export type DiscordWebhookMessage = RESTPostAPIWebhookWithTokenJSONBody;
