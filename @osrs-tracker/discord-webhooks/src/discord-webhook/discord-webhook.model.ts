import { RESTPostAPIWebhookWithTokenJSONBody } from 'discord-api-types/v10';

/**
 * Optional parameters for the Discord webhook.
 */
export interface DiscordWebhookOptions {
  /**
   * The webhook URL to send the message to. If not provided, the webhook URL will be read from `process.env.WEBHOOK_URL`.
   *
   * @optional
   * @default process.env.WEBHOOK_URL
   */
  webhookUrl: string;
}

/**
 * The message to send to the Discord webhook.
 *
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
export type DiscordWebhookMessage = RESTPostAPIWebhookWithTokenJSONBody;
