# OSRS Tracker AWS &middot; [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/main/LICENSE) [![GitHub issues](https://img.shields.io/github/issues/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/issues) &middot; [![CI](https://github.com/osrs-tracker/osrs-tracker-aws/actions/workflows/main.yml/badge.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/actions/workflows/main.yml)

This repository holds the background jobs and shared packages behind
[OSRS Tracker](https://osrs-tracker.freekmencke.com), a website for tracking item prices and player progress in Old
School RuneScape.

## Background jobs

Each job is a small AWS Lambda function in [`lambda/`](lambda):

- **refresh-items**: every hour, fetches the full item list from the
  [OSRS Wiki prices API](https://prices.runescape.wiki) and saves it to the database.
- **queue-players**: every hour, finds the tracked players whose daily snapshot is due at that hour and puts them in a
  queue.
- **process-players**: picks players from that queue, fetches their current hiscores and saves them as a new daily
  snapshot. Players that fail are retried, and persistent failures are reported on Discord.
- **clean-hiscores**: every night at midnight (UTC), removes snapshots older than 60 days.

## Shared packages

- [`@osrs-tracker/models`](https://www.npmjs.com/package/@osrs-tracker/models): the shared data types (players, items,
  hiscores, news) used by the website, the API and these jobs.
- [`@osrs-tracker/hiscores`](https://www.npmjs.com/package/@osrs-tracker/hiscores): parses OSRS hiscores (including
  older formats since March 2023), compares snapshots and does XP calculations.
- [`@osrs-tracker/discord-webhooks`](https://www.npmjs.com/package/@osrs-tracker/discord-webhooks): a tiny helper for
  sending messages to a Discord webhook.

## How it fits together

The jobs collect item and player data into a MongoDB database. The [website](https://osrs-tracker.freekmencke.com)
([osrs-tracker-web](https://github.com/osrs-tracker/osrs-tracker-web)) and the
[API](https://github.com/osrs-tracker/osrs-tracker-api) read that data to show prices and player progress. Hiscores are
fetched from Jagex through a small proxy (`runescape-api.freekmencke.com`), which the website and the API use as well.

## Running a job locally

Each job is its own npm project. From its folder, install and build it with `npm ci` and `npm run build`.

To run a job against the real services without changing anything, copy `.env.example` to `.env`, fill in the values, and
run:

```bash
npm run invoke:dry
```

This runs the job once with `DRY_RUN=true`. It still reads data and calls the external APIs, but every write (to the
database, the queue or Discord) is only logged. Locally the jobs log in to the database with `MONGODB_USERNAME` and
`MONGODB_PASSWORD`.

## Built with

TypeScript, AWS Lambda on Node 24, Amazon SQS, Amazon EventBridge and MongoDB Atlas.

## Development

OSRS Tracker was originally built entirely without AI assistance. Since October 2026, I've started using
[Claude](https://claude.com/claude-code), Anthropic's AI coding assistant, to help improve development speed and
reliability.
