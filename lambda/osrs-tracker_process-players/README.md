# osrs-tracker_process-players

Invoked asynchronously by queue-players, with an event `{ usernames, scrapingOffset }`. For each username in it, it
fetches the normal hiscore through the hiscore proxy (`getHiscore` from `@osrs-tracker/hiscores`) and prepends a new
entry to the player's `hiscoreEntries` in the compact stored format (`encodeHiscoreEntry` and
`hiscoreEntriesWriteExpression` from `@osrs-tracker/models`), which also strips the previous entry for the same offset.

- **Layouts:** before writing the entries it upserts their layout (the skill and activity names Jagex used) in the
  `hiscoreLayouts` collection, in the same database, once per layout per warm Lambda. When a layout can't be stored
  (Atlas unreachable, or a stored layout with the same id but other names: a hash collision), nothing was written for
  that event's players yet, so they're retried like failed fetches below.

- **Scrape results queue:** once the bulk write settles, it sends the found players' hiscores (as fetched, with the
  scrape time and offset) as one `hiscores` message to `osrs-tracker_scrape-results.fifo`, in group `offset:<offset>`,
  for the ingester on fremen-server (`ScrapeResultMessage` from `@osrs-tracker/models`). For now it still writes MongoDB
  too, so the ingester finds these entries stored and skips them (#165); #166 stops the writes. The not-found usernames
  stay out of the message while this Lambda records them, or the ingester would count each 404 twice. A message the
  queue doesn't take is reported on Discord (`Failed to send scrape results`), never thrown.

- **Failed** fetches (5xx, network, timeout), and players whose layout couldn't be stored, are requeued: it invokes
  itself with them in new events, `retry` counted up, at most 3 times; after that they're reported on Discord. When
  every fetch in the run failed (so nothing was written) it throws instead, so Lambda retries the event twice; then it
  goes to the on-failure destination ([INFRA.md](../../.claude/skills/osrs-tracker-aws/INFRA.md)). That failure is
  reported on Discord too for a requeued event. After the writes it never throws, since a retry would store duplicate
  entries: a failed write or a retry that can't be queued is reported on Discord instead.
- **Not found** (HTTP 404/400) is skipped without retry and counted. After 7 days off the hiscores the player's
  `scrapingOffsets` move to `pausedScrapingOffsets`, so they're no longer queued, and this is reported on Discord. The
  API restores them on the next lookup (see the pause/resume contract in [DATA-MODEL.md](../../DATA-MODEL.md)).

Environment (validated at cold start by `src/env.ts` with `lambda/shared/src/env.ts`, which names any missing or invalid
variable): `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_COLLECTION`, `OSRS_API_BASE_URL`, `PLAYERS_PER_EVENT`,
`SCRAPE_RESULTS_QUEUE_URL`, `WEBHOOK_URL`. Optional: `MONGODB_USERNAME`/`MONGODB_PASSWORD` (local SCRAM only) and
`DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then
`npm run invoke:dry -- Zezima "Lynx Titan"`. See the [root README](../../README.md) for how it fits with the other jobs.
