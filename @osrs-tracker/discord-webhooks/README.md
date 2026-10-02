# @osrs-tracker/discord-webhooks &middot; [![NPM package](https://img.shields.io/npm/v/@osrs-tracker/discord-webhooks.svg)](https://www.npmjs.com/package/@osrs-tracker/discord-webhooks) [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/main/LICENSE)

A tiny helper for sending messages to a [Discord webhook](https://discord.com/developers/docs/resources/webhook), with
typings for the message body. [OSRS Tracker](https://osrs-tracker.freekmencke.com) uses it to report errors from its
background jobs.

## Install

```bash
npm install @osrs-tracker/discord-webhooks
```

## Usage

```ts
import { DiscordWebhook } from '@osrs-tracker/discord-webhooks';

// Sends to process.env.WEBHOOK_URL, unless you pass { webhookUrl } as the second argument
await DiscordWebhook.dispatch({
  embeds: [{ title: 'Something went wrong', description: 'Details here', color: 0xff0000 }],
});
```

## Development

OSRS Tracker was originally built entirely without AI assistance. Since October 2026, I've started using
[Claude](https://claude.com/claude-code), Anthropic's AI coding assistant, to help improve development speed and
reliability.
