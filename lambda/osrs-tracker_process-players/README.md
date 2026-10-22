# osrs-tracker_process-players

Invoked asynchronously by queue-players, with an event `{ usernames, scrapingOffset }`. For each username in it, it
fetches the normal hiscore through the hiscore proxy (`getHiscore` from `@osrs-tracker/hiscores`), then sends the run's
results as one `hiscores` message (`ScrapeResultMessage` from `@osrs-tracker/models`) to
`osrs-tracker_scrape-results.fifo`, in group `offset:<offset>`: the found players' hiscores as fetched, the usernames
not on the hiscores, the scrape time and the offset. It has no database: the ingester on fremen-server
(osrs-tracker-api) stores the hiscore entries and their layouts, records the 404s and pauses players (#166).

- **Failed** fetches (5xx, network, timeout) are requeued: it invokes itself with them in new events, `retry` counted
  up, at most 3 times; after that they're reported on Discord.
- **It throws**, so Lambda retries the event twice before the on-failure destination
  ([INFRA.md](../../.claude/skills/osrs-tracker-aws/INFRA.md)), in two cases: every fetch in the run failed (nothing to
  send; reported on Discord too for a requeued event), or the queue didn't take the message. The retry scrapes the event
  again, and the ingester skips an entry it already stored. Once the message is sent it never throws, since a retry
  would requeue the failed players a second time: a retry that can't be queued is reported on Discord instead.
- **Not found** (HTTP 404/400) is skipped without retry and sent in the message's `notFound`. After 7 days off the
  hiscores the ingester moves the player's `scrapingOffsets` to `pausedScrapingOffsets`, so they're no longer queued,
  and reports it on Discord. The API restores them on the next lookup (see the pause/resume contract in
  osrs-tracker-api's
  [DATA-MODEL.md](https://github.com/osrs-tracker/osrs-tracker-api/blob/main/DATA-MODEL.md#pauseresume-contract)).

Environment (validated at cold start by `src/env.ts` with `lambda/shared/src/env.ts`, which names any missing or invalid
variable): `OSRS_API_BASE_URL`, `PLAYERS_PER_EVENT`, `SCRAPE_RESULTS_QUEUE_URL`, `WEBHOOK_URL`. Optional: `DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then
`npm run invoke:dry -- Zezima "Lynx Titan"`. See the [root README](../../README.md) for how it fits with the other jobs.
