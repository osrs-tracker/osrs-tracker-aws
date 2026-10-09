# osrs-tracker_queue-players

Runs every hour (EventBridge `Hourly`). Works out the scraping offset for that hour (-12 to +11 hours from UTC
midnight), finds every player whose `scrapingOffsets` contain it, and sends their usernames to the
`osrs-tracker_players-to-scrape` SQS queue in messages of `PLAYERS_PER_SQS_MESSAGE` usernames for process-players. It
also ensures the `{ scrapingOffsets: 1 }` index it reads with. Failed queue sends are reported on Discord.

Environment (validated at cold start by `src/env.ts`, which names any missing or invalid variable): `MONGODB_URI`,
`MONGODB_DATABASE`, `MONGODB_COLLECTION`, `PLAYERS_PER_SQS_MESSAGE`, `SQS_QUEUE_URL`, `WEBHOOK_URL`. Optional:
`MONGODB_USERNAME`/`MONGODB_PASSWORD` (local SCRAM only) and `DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then `npm run invoke:dry`
(optionally `-- 2026-10-02T18:00:00Z` for another hour). See the [root README](../../README.md) and
[DATA-MODEL.md](../../DATA-MODEL.md) for how it fits with the other jobs and the API.
