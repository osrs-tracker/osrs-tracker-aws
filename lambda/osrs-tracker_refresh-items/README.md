# osrs-tracker_refresh-items

Runs every hour (EventBridge `Hourly`). Fetches the full item list from the
[OSRS Wiki prices API](https://prices.runescape.wiki/api/v1/osrs/mapping) and upserts each item into the `items`
collection by `id`. Fails the run when no items were upserted.

Environment (validated at cold start by `src/env.ts`, which names any missing or invalid variable): `MONGODB_URI`,
`MONGODB_DATABASE`, `MONGODB_COLLECTION`. Optional: `MONGODB_USERNAME`/`MONGODB_PASSWORD` (local SCRAM only) and
`DRY_RUN`.

Run it locally without writing anything: copy `.env.example` to `.env`, fill it in, then `npm run invoke:dry`. See the
[root README](../../README.md) and [DATA-MODEL.md](../../DATA-MODEL.md) for how it fits with the other jobs and the API.
