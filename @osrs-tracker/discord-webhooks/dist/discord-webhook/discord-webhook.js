export var DiscordWebhook;
(function (DiscordWebhook) {
    function dispatch(data, options) {
        return fetch(options?.webhookUrl ?? process.env.WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    }
    DiscordWebhook.dispatch = dispatch;
})(DiscordWebhook || (DiscordWebhook = {}));
