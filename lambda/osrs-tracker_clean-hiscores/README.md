# osrs-tracker_clean-hiscores

Runs every night at 00:00 UTC (EventBridge `daily`). Removes hiscore entries older than `MAX_AGE_IN_DAYS` (60 in
production) from every player. When none were found it reports on Discord and fails the run, since every night should
age out a day of entries. Then it deletes the layouts in `hiscoreLayouts` (same database) that no entry uses any more,
except those from the last day, whose first entry may still be being written.

Environment (validated at cold start by `src/env.ts` with `lambda/shared/src/env.ts`, which names any missing or invalid
variable): `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_COLLECTION`, `MAX_AGE_IN_DAYS`, `WEBHOOK_URL`. Optional:
`MONGODB_USERNAME`/`MONGODB_PASSWORD` (local SCRAM only) and `DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then `npm run invoke:dry` (it only
counts the players it would change and lists the layouts it would delete). It ignores an event time argument, and its
cutoff is midnight in your machine's timezone, not UTC as in production. See the [root README](../../README.md) and
[DATA-MODEL.md](../../DATA-MODEL.md) for how it fits with the other jobs and the API.
