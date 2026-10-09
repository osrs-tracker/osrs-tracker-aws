# osrs-tracker_process-players

Triggered by the `osrs-tracker_players-to-scrape` SQS queue that queue-players fills. For each username in a message it
fetches the normal hiscore through the hiscore proxy (`getHiscore` from `@osrs-tracker/hiscores`) and prepends a new
entry to the player's `hiscoreEntries`.

- **Failed** fetches (5xx, network, timeout) are sent back to the queue; when every fetch in the run failed (so nothing
  was written) it throws so SQS retries the message. Failures on a retried message are reported on Discord. After the
  writes it never throws, since a retry would store duplicate entries: a failed write or a retry that can't be queued is
  reported on Discord instead.
- **Not found** (HTTP 404/400) is skipped without retry and counted. After 7 days off the hiscores the player's
  `scrapingOffsets` move to `pausedScrapingOffsets`, so they're no longer queued, and this is reported on Discord. The
  API restores them on the next lookup (see the pause/resume contract in [DATA-MODEL.md](../../DATA-MODEL.md)).

Environment (validated at cold start by `src/env.ts` with `lambda/shared/src/env.ts`, which names any missing or invalid
variable): `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_COLLECTION`, `OSRS_API_BASE_URL`, `PLAYERS_PER_SQS_MESSAGE`,
`SQS_QUEUE_URL`, `WEBHOOK_URL`. Optional: `MONGODB_USERNAME`/`MONGODB_PASSWORD` (local SCRAM only) and `DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then
`npm run invoke:dry -- Zezima "Lynx Titan"`. See the [root README](../../README.md) for how it fits with the other jobs.
