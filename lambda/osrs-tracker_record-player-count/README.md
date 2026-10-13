# osrs-tracker_record-player-count

Runs every 10 minutes (EventBridge `osrs-tracker_record-player-count`, `rate(10 minutes)`). Fetches Jagex's world list
(`https://www.runescape.com/g=oldscape/slr.ws?order=LPWM`, the one the client's World Select uses), sums the players on
every world, and inserts one `PlayerCount` (`@osrs-tracker/models`) into the `playerCounts` collection: `date`, `total`,
`members`, `f2p`, `worlds` and `byLocation` (players per raw location code). Samples are kept forever (about 52,560 a
year, roughly 10 MB). It creates the `{ date: 1 }` index the API reads by.

The world list is an undocumented big-endian binary format; `parseWorldList` in `src/utils/world-list.utils.ts`
describes it, and its spec runs on a response captured on 2026-10-13. Its total is slightly below the "people playing"
on oldschool.runescape.com, which likely also counts the lobby.

When the request fails, the response doesn't parse (the format changed), or it has 0 worlds or 0 players, it inserts
nothing, reports on Discord (`Player count not recorded`) and fails the run. Async retries are off, so each failed run
alerts once.

Environment (validated at cold start by `src/env.ts` with `lambda/shared/src/env.ts`, which names any missing or invalid
variable): `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_COLLECTION` (`playerCounts`), `WEBHOOK_URL`. Optional:
`MONGODB_USERNAME`/`MONGODB_PASSWORD` (local SCRAM only) and `DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then `npm run invoke:dry`. Its
tests: `npx vitest run` (`npm test` is watch mode). See the [root README](../../README.md) and
[DATA-MODEL.md](../../DATA-MODEL.md) for how it fits with the other jobs and the API.
