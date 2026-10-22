# osrs-tracker_queue-players

Runs every hour (EventBridge `Hourly`). Works out the scraping offset for that hour (-12 to +11 hours from UTC
midnight), scans the DynamoDB table `SUBSCRIPTIONS_TABLE` for every player whose `scrapingOffsets` contain it, and
invokes process-players (`PROCESS_PLAYERS_FUNCTION`) asynchronously with their usernames, one event of
`PLAYERS_PER_EVENT` usernames at a time. Events Lambda refuses are reported on Discord, and so is an empty table
(nothing is queued then).

The table is a copy of MongoDB's `players.scrapingOffsets`, written only by osrs-tracker-api's ingester every 15
minutes, so scraping goes on while MongoDB is unreachable. queue-players only reads it and has no database access.

Environment (validated at cold start by `src/env.ts` with `lambda/shared/src/env.ts`, which names any missing or invalid
variable): `PLAYERS_PER_EVENT`, `PROCESS_PLAYERS_FUNCTION`, `SUBSCRIPTIONS_TABLE`, `WEBHOOK_URL`. Optional: `DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then
`AWS_PROFILE=<profile> npm run invoke:dry` (optionally `-- 2026-10-02T18:00:00Z` for another hour). See the
[root README](../../README.md) and osrs-tracker-api's
[DATA-MODEL.md](https://github.com/osrs-tracker/osrs-tracker-api/blob/main/DATA-MODEL.md) for how it fits with the other
jobs and the API.
