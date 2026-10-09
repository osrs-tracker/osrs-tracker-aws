# osrs-tracker_clean-hiscores

Runs every night at 00:00 UTC (EventBridge `daily`). Removes hiscore entries older than `MAX_AGE_IN_DAYS` (60 in
production) from every player. When none were found it reports on Discord and fails the run, since every night should
age out a day of entries.

Environment (validated at cold start by `src/env.ts`, which names any missing or invalid variable): `MONGODB_URI`,
`MONGODB_DATABASE`, `MONGODB_COLLECTION`, `MAX_AGE_IN_DAYS`, `WEBHOOK_URL`. Optional:
`MONGODB_USERNAME`/`MONGODB_PASSWORD` (local SCRAM only) and `DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then `npm run invoke:dry` (it only
counts the players it would change). See the [root README](../../README.md) and [DATA-MODEL.md](../../DATA-MODEL.md) for
how it fits with the other jobs and the API.
