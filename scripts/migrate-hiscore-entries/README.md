# migrate-hiscore-entries

One-off script that rewrites `players.hiscoreEntries` from Jagex's JSON shape to the compact stored format of
`@osrs-tracker/models` 2.0.0 and fills `hiscoreLayouts` (osrs-tracker/osrs-tracker-aws#56, roadmap
osrs-tracker/osrs-tracker-aws#52). It runs during the cutover, osrs-tracker/osrs-tracker-aws#57.

**A dry run is the default**: it only reads and reports. Writing needs `--write`. There is no staging database and the
Atlas free tier has no backups: take the `mongodump` from #57 before a write against production.

## Run

Node 24 runs the TypeScript directly (type stripping), so there is no build step.

```bash
cd scripts/migrate-hiscore-entries
npm ci
cp .env.example .env   # fill in

npm run migrate                       # dry run: read, convert in memory, check, report
npm run migrate -- --player Zezima    # dry run for one player
npm run migrate -- --limit 20         # dry run for the first 20 players (by username)
npm run migrate -- --write            # write layouts and entries
```

`npm run migrate` is `node --env-file=.env src/cli.ts`. It exits non-zero when any player failed.

## What it does

One player at a time (the free tier has a 32 MB in-memory sort limit and an operations-per-second cap, so no big
aggregation). It first lists the usernames with entries (in `username` index order), then per player:

1. Reads its `hiscoreEntries`: old entries (`{ date, scrapingOffset, skills: [...], activities: [...], name? }`), new
   ones (`{ d, o, l, s, a }`) or a mix (the old API keeps writing old-format entries until it's replaced).
2. Decodes the new ones with the layouts from `hiscoreLayouts`, maps the old ones with hiscores' `fromJagex`, sorts all
   newest first by date, builds the layouts (`since` = the oldest entry using it), encodes each entry and strips it
   against the next newer entry with the same offset with models' `stripUnchangedValues`: what the write expression
   would have stored writing them one by one.
3. **Checks** that the result decodes to exactly the mapped entries, levels included. On any difference the player is
   reported with the entry and nothing is written for it; the run continues.
4. A player whose entries are all new-format and already stripped is skipped, so a second run only converts what was
   written in between and a run can resume after a failure.
5. With `--write`: upserts its layouts (`$setOnInsert` names, `$min` since; a layout id with other names stops the run)
   and replaces its entries with one `updateOne` that only matches while the entry count and the newest entry's date are
   as read. A miss is reported and retried once by re-reading.

The report: players seen, converted, skipped and failed; entries; existing and new layouts; and the BSON size of
`hiscoreEntries` before and after (about 87% smaller expected on production data).

## Test

```bash
npx vitest run         # unit tests and integration tests on mongodb-memory-server (MongoDB 8.0, like production)
npx tsc --noEmit -p .
```

The old-format fixtures are built from the real responses in `@osrs-tracker/hiscores/src/fixtures/jagex-hiscores.json`.
