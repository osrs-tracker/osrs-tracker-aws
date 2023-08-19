import { BaseMessageOptions, MessageMentionOptions } from 'discord.js';

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
export interface DiscordWebhookMessage extends Omit<BaseMessageOptions, 'allowedMentions'> {
  // changed from allowedMentions to allowed_mentions to match discord api
  allowed_mentions?: Omit<MessageMentionOptions, 'repliedUser'> & { replied_user: boolean };

  username?: string;
  avatar_url?: string;
}
