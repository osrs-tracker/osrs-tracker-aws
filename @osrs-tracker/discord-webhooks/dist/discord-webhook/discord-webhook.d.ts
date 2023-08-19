import { DiscordWebhookMessage, DiscordWebhookOptions } from './discord-webhook.model';
export declare namespace DiscordWebhook {
    function dispatch(data: DiscordWebhookMessage, options?: Partial<DiscordWebhookOptions>): Promise<any>;
}
