import { DiscordWebhookMessage, DiscordWebhookOptions } from './discord-webhook.model';

export namespace DiscordWebhook {
  export function dispatch(data: DiscordWebhookMessage, options?: Partial<DiscordWebhookOptions>): Promise<any> {
    return fetch(options?.webhookUrl ?? process.env.WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
}
