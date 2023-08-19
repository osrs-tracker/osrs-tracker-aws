import { BaseMessageOptions, MessageMentionOptions } from 'discord.js';
export interface DiscordWebhookOptions {
    webhookUrl: string;
}
export interface DiscordWebhookMessage extends Omit<BaseMessageOptions, 'allowedMentions'> {
    allowed_mentions?: Omit<MessageMentionOptions, 'repliedUser'> & {
        replied_user: boolean;
    };
    username?: string;
    avatar_url?: string;
}
