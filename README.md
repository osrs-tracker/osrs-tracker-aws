# OSRS Tracker AWS &middot; [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/main/LICENSE) [![GitHub issues](https://img.shields.io/github/issues/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/issues) &middot; [![CI](https://github.com/osrs-tracker/osrs-tracker-aws/actions/workflows/main.yml/badge.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/actions/workflows/main.yml)

This repository holds the background jobs and shared packages behind
[OSRS Tracker](https://osrs-tracker.freekmencke.com), a website for tracking item prices and player progress in Old
School RuneScape.

## Background jobs

Each job is a small AWS Lambda function in [`lambda/`](lambda):

| Job                                                    | Runs       | Description                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [refresh‑items](lambda/osrs-tracker_refresh-items)     | Hourly     | Fetches the full item list from the [OSRS Wiki prices API](https://prices.runescape.wiki) and saves it to the database.                                                                                                                   |
| [queue‑players](lambda/osrs-tracker_queue-players)     | Hourly     | Finds the tracked players whose daily snapshot is due at that hour and puts them in a queue.                                                                                                                                              |
| [process‑players](lambda/osrs-tracker_process-players) | From queue | Fetches the player's current hiscores and saves them as a new daily snapshot. Failures are retried, and persistent ones are reported on Discord. Players off the hiscores for 7 days stop being queued until someone looks them up again. |
| [clean‑hiscores](lambda/osrs-tracker_clean-hiscores)   | Nightly    | Removes snapshots older than 60 days, at midnight (UTC).                                                                                                                                                                                  |

## Shared packages

| Package                                                                                        | Version                                                                                                                               | Description                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [`@osrs-tracker/models`](https://www.npmjs.com/package/@osrs-tracker/models)                   | [![npm](https://img.shields.io/npm/v/@osrs-tracker/models.svg)](https://www.npmjs.com/package/@osrs-tracker/models)                   | The shared data types (players, items, hiscores, news) used by the website, the API and these jobs.              |
| [`@osrs-tracker/hiscores`](https://www.npmjs.com/package/@osrs-tracker/hiscores)               | [![npm](https://img.shields.io/npm/v/@osrs-tracker/hiscores.svg)](https://www.npmjs.com/package/@osrs-tracker/hiscores)               | Fetches OSRS hiscores, names the skills and activities, compares snapshots and does XP calculations.             |
| [`@osrs-tracker/express-metrics`](https://www.npmjs.com/package/@osrs-tracker/express-metrics) | [![npm](https://img.shields.io/npm/v/@osrs-tracker/express-metrics.svg)](https://www.npmjs.com/package/@osrs-tracker/express-metrics) | Prometheus HTTP metrics for the website's and the API's servers.                                                 |
| [`@osrs-tracker/logger`](https://www.npmjs.com/package/@osrs-tracker/logger)                   | [![npm](https://img.shields.io/npm/v/@osrs-tracker/logger.svg)](https://www.npmjs.com/package/@osrs-tracker/logger)                   | Structured JSON logs (request logs, outgoing requests, errors) for the website's and the API's servers, on pino. |

## How it fits together

The jobs collect item and player data into a MongoDB database. The [website](https://osrs-tracker.freekmencke.com)
([osrs-tracker-web](https://github.com/osrs-tracker/osrs-tracker-web)) and the
[API](https://github.com/osrs-tracker/osrs-tracker-api) read that data to show prices and player progress. Hiscores are
fetched from Jagex through a small proxy (`runescape-api.freekmencke.com`), which the website and the API use as well.

The jobs and the API write to the same collections. [DATA-MODEL.md](DATA-MODEL.md) describes which side writes each
field and owns each index.

## Running a job locally

Each job is its own npm project. From its folder, install and build it with `npm ci` and `npm run build`.

To run a job against the real services without changing anything, copy `.env.example` to `.env`, fill in the values, and
run:

```bash
npm run invoke:dry
```

This runs the job once with `DRY_RUN=true`. It still reads data and calls the external APIs, but every write (to the
database, the queue or Discord) is only logged. You need Node 24.

What goes in `.env` (each job's `.env.example` lists the ones it needs):

| Variable                               | Locally                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`, `MONGODB_DATABASE`      | The Atlas cluster's connection string and database name.                                              |
| `MONGODB_COLLECTION`                   | `players`, or `items` for refresh-items.                                                              |
| `MONGODB_USERNAME`, `MONGODB_PASSWORD` | An Atlas database user. Required locally: without them the driver tries AWS authentication and fails. |
| `OSRS_API_BASE_URL`                    | The hiscore proxy, `https://runescape-api.freekmencke.com/rs`.                                        |
| `PLAYERS_PER_SQS_MESSAGE`              | Any whole number of at least 1; it only changes how the logged messages are grouped.                  |
| `SQS_QUEUE_URL`, `WEBHOOK_URL`         | Any valid URL: a dry run never sends to the queue or Discord.                                         |
| `MAX_AGE_IN_DAYS`                      | `60`, as in production.                                                                               |

## Built with

TypeScript, AWS Lambda on Node 24, Amazon SQS, Amazon EventBridge and MongoDB Atlas.

## Development

OSRS Tracker was originally built entirely without AI assistance. Since October 2026, I've started using
[Claude](https://claude.com/claude-code), Anthropic's AI coding assistant, to help improve development speed and
reliability.
