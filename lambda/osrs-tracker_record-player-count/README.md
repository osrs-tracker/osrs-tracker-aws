# osrs-tracker_record-player-count

Runs every 10 minutes (EventBridge `osrs-tracker_record-player-count`, `rate(10 minutes)`). Fetches Jagex's world list
(`https://www.runescape.com/g=oldscape/slr.ws?order=LPWM`, the one the client's World Select uses), sums the players on
every world, and sends one `PlayerCount` (`@osrs-tracker/models`) as a `playerCount` message to the scrape results queue
(`osrs-tracker_scrape-results.fifo`, group `playerCount`): `date` (an ISO string), `total`, `members`, `f2p`, `worlds`
and `byLocation` (players per raw location code). It has no database: the ingester on fremen-server (osrs-tracker-api)
stores the sample in `playerCounts` and recomputes the day's averages in `playerCountsDaily` (#166); it creates both
collections' indexes from osrs-tracker/osrs-tracker-api#205 on. Details in osrs-tracker-api's
[DATA-MODEL.md](https://github.com/osrs-tracker/osrs-tracker-api/blob/main/DATA-MODEL.md).

The world list is an undocumented big-endian binary format; its client and parser (`fetchWorldList`, `parseWorldList`)
live in `@osrs-tracker/hiscores`, which osrs-tracker-api uses for its live count, and are tested there on a response
captured on 2026-10-13. The Lambda fetches Jagex itself, not through the API, so recording doesn't depend on the API.
Its total is slightly below the "people playing" on oldschool.runescape.com, which likely also counts the lobby.

When the request fails, the response doesn't parse (the format changed), it has 0 worlds or 0 players, or the queue
doesn't take the message, nothing is recorded: it reports on Discord (`Player count not recorded`) and fails the run.
Async retries are off, so each failed run alerts once and its sample stays missed.

Environment (validated at cold start by `src/env.ts` with `lambda/shared/src/env.ts`, which names any missing or invalid
variable): `SCRAPE_RESULTS_QUEUE_URL`, `WEBHOOK_URL`. Optional: `DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then `npm run invoke:dry`. See the
[root README](../../README.md) and osrs-tracker-api's
[DATA-MODEL.md](https://github.com/osrs-tracker/osrs-tracker-api/blob/main/DATA-MODEL.md) for how it fits with the other
jobs and the API.
