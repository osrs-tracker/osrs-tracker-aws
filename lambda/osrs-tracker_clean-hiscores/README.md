# osrs-tracker_clean-hiscores

Runs every night at 00:00 UTC (EventBridge `daily`), in this order:

1. Drops each player's scraping offsets (active or paused) that nobody looked up for 180 days (`scrapingOffsetLookups`,
   set by the API on every lookup), together with all their hiscore entries, but always keeps the most recently looked
   up offset, so every player keeps being scraped once a day. An offset without a lookup date gets the current time.
2. Removes hiscore entries older than `MAX_AGE_IN_DAYS` (60 in production) from every player.
3. Deletes the layouts in `hiscoreLayouts` (same database) that no entry uses any more, except those from the last day,
   whose first entry may still be being written.
4. Deletes the players without hiscore entries: none left after the pull means the player wasn't scraped or looked up
   for `MAX_AGE_IN_DAYS`, and a lookup through the API creates it again.
5. When step 2 found nothing to remove, reports on Discord and fails the run, since every night should age out a day of
   entries. Steps 1, 3 and 4 have run by then.

Environment (validated at cold start by `src/env.ts` with `lambda/shared/src/env.ts`, which names any missing or invalid
variable): `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_COLLECTION`, `MAX_AGE_IN_DAYS`, `WEBHOOK_URL`. Optional:
`MONGODB_USERNAME`/`MONGODB_PASSWORD` (local SCRAM only) and `DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then `npm run invoke:dry` (it lists
the players whose offsets it would drop, counts the players it would change and lists the layouts and players it would
delete; it doesn't apply the pull, so it can't list players whose last entries tonight's pull would remove). It ignores
an event time argument, and its cutoff is midnight in your machine's timezone, not UTC as in production. See the
[root README](../../README.md) and [DATA-MODEL.md](../../DATA-MODEL.md) for how it fits with the other jobs and the API.
