# osrs-tracker_record-player-count

Runs every 10 minutes (EventBridge `osrs-tracker_record-player-count`, `rate(10 minutes)`). Fetches Jagex's world list
(`https://www.runescape.com/g=oldscape/slr.ws?order=LPWM`, the one the client's World Select uses), sums the players on
every world, and inserts one `PlayerCount` (`@osrs-tracker/models`) into the `playerCounts` collection: `date`, `total`,
`members`, `f2p`, `worlds` and `byLocation` (players per raw location code). Samples are kept forever (about 52,560 a
year, roughly 10 MB). It creates the `{ date: 1 }` index the API reads by.

Then it recomputes the daily averages, one `PlayerCountDay` per UTC day in `playerCountsDaily` (`total`, `members`,
`f2p` and `byLocation` per code, rounded, the day's `peak` and its number of `samples`), which the API serves for its
`1y` and `all` history. One aggregation over the samples from the newest stored day on (normally only today; every
sample on the first run, the backfill) ends in `$merge` on `date`, so a run repairs whatever an earlier one missed. It
creates that collection's unique `{ date: 1 }` index, which `$merge` needs. Details in
[DATA-MODEL.md](../../DATA-MODEL.md).

The world list is an undocumented big-endian binary format; its client and parser (`fetchWorldList`, `parseWorldList`)
live in `@osrs-tracker/hiscores`, which osrs-tracker-api uses for its live count, and are tested there on a response
captured on 2026-10-13. The Lambda fetches Jagex itself, not through the API, so recording doesn't depend on the API.
Its total is slightly below the "people playing" on oldschool.runescape.com, which likely also counts the lobby.

When the request fails, the response doesn't parse (the format changed), or it has 0 worlds or 0 players, it inserts
nothing, reports on Discord (`Player count not recorded`) and fails the run. Async retries are off, so each failed run
alerts once. When only the daily averages fail, the sample is stored: it reports `Daily player counts not updated` and
the run succeeds.

Environment (validated at cold start by `src/env.ts` with `lambda/shared/src/env.ts`, which names any missing or invalid
variable): `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_COLLECTION` (`playerCounts`), `MONGODB_DAILY_COLLECTION`
(`playerCountsDaily`), `WEBHOOK_URL`. Optional: `MONGODB_USERNAME`/`MONGODB_PASSWORD` (local SCRAM only) and `DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then `npm run invoke:dry`. See the
[root README](../../README.md) and [DATA-MODEL.md](../../DATA-MODEL.md) for how it fits with the other jobs and the API.
