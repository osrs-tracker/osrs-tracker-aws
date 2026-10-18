## 2.6.0 - 2026-10-18

- `PLAYER_COUNT_RANGES` (`as const`), `PlayerCountRange` and `PlayerCountPoint`: the ranges of osrs-tracker-api's
  `GET /player-counts?range=` and one point of the history it returns (a sample, or an hourly or daily average, with
  `peak` on daily points). Moved here from osrs-tracker-api and osrs-tracker-web, which each defined them by hand (issue
  #151).
- `StoredNewsItem` (`OsrsNewsItem` with `description` and `enclosure` optional, for the backfilled posts) and
  `NewsArchivePage` (`GET /news/archive`'s `{ posts, next }`), moved here from the same two copies (issue #151).
- Dev tooling only (issue #145): `allowScripts` approves `mongodb-memory-server@11.3.0`'s install script, which
  downloads the MongoDB binary for the tests. npm 12 skips unapproved dependency scripts; without it the first test run
  downloads the binary instead and can time out. Pinned to the version, so an update re-approves it
  (`npm install-scripts approve mongodb-memory-server`). The published code is unchanged.
- Dev tooling only (issues #130 and #131, from the tech-debt roadmap #103): linted with the Lambdas' config
  (`npm run lint`, also in CI), with oxlint instead of ESLint until typescript-eslint supports TypeScript 7 (#143). It
  found nothing to fix; the build is unchanged.
- Dev tooling only (issues #129 and #131, from the tech-debt roadmap #103): TypeScript `^7.0.2` (was `^5.9.3`), with
  `bundler` module resolution and `rootDir: "src"`, the options TypeScript 7 requires. The JavaScript and `.d.ts` files
  are byte-for-byte the same; the CommonJS source maps and `codec.d.ts.map` map some lines differently.
- Dev tooling only (issue #108, from the tech-debt roadmap #103): TypeScript `^5.9.3` instead of an exact 5.8.2 pin (the
  build is byte-for-byte the same), `mongodb-memory-server` 11 for the in-memory MongoDB 8.0.12 tests, and
  `vitest.config.mts`, which silences Vite's warning about ESM syntax in a file loaded as CommonJS. New specs cover
  `calculateXPForSkillLevel` above level 126 and for a non-integer level (it counts up to the next whole level).

## 2.5.0 - 2026-10-14

- `PlayerCountDay`: a `playerCountsDaily` document, one UTC day's averages of the `playerCounts` samples (`total`,
  `members`, `f2p`, and `byLocation` averaged per code over the samples that have it, all rounded), its `peak` total and
  how many `samples` it averages. Recomputed by the record-player-count Lambda on every run, read by osrs-tracker-api
  for its `1y` and `all` history (osrs-tracker/osrs-tracker-api#159).
- `PlayerCount.byLocation`: the source comment names every location code (8 Brazil, 9 Japan, 10 Singapore, 12 South
  Africa were unknown). Comment only.

## 2.4.0 - 2026-10-13

- `PlayerCount`: a `playerCounts` document, the number of players online summed over Jagex's world list (`total`,
  `members`, `f2p`, `worlds`, and `byLocation` keyed by the raw location code). Written every 10 minutes by the
  record-player-count Lambda, read by osrs-tracker-api.

## 2.3.0 - 2026-10-10

- `Player.scrapingOffsetLookups`: when a visitor last looked the player up per scraping offset, keyed by the offset as a
  string. Set by osrs-tracker-api, read by clean-hiscores to drop the offsets nobody uses.
- The write expression's source comment no longer refers to the migration script, which was removed. Comment only.

## 2.2.0 - 2026-10-10

- `skillProgress(skill)`: a skill's level, xp and percentage into its level (`null` at 99), with a skill that has no xp
  or isn't in the entry shown as untrained (level 1, 0 xp, 0%). `percentageToNextLevel(xp, level)`: the percentage on
  its own, next to `calculateXPToNextLevel` (moved here from osrs-tracker-web).

## 2.1.0 - 2026-10-10

- `HiscoreDiff` (with `HiscoreDiffSkill` and `HiscoreDiffActivity`): the result of `hiscoreDiff` in
  `@osrs-tracker/hiscores` 4.1.0, in which no value is ever `null`, so code that reads a diff needs no fallbacks.
- `skillLevel(skill)`: a skill's level, `UNTRAINED_LEVEL` (1) when it has no xp or isn't in the entry, the way Jagex
  shows it. `overallOf(entry)`: an entry's Overall, which is never `null`; throws when it's missing.

## 2.0.0 - 2026-10-10

- **Breaking:** hiscore entries are keyed by name. `HiscoreEntry.skills` and `.activities` are objects (`skills.Attack`,
  not an array with `name` and `id`); `rank` is `null` when unranked (the value is still there), a value is `null` when
  there is none (was `-1`/`0`), and a missing key means the name wasn't on the hiscores then. `SkillName`/`ActivityName`
  accept any string, so new skills and activities work before the enums know them. Overall is never `null`.
  `HiscoreItem` is gone.
- The compact stored format: `StoredHiscoreEntry` (`d`, `o`, `l`, `s`, `a`, values by position in a layout, unchanged
  values as a bare rank), `HiscoreLayout` (a `hiscoreLayouts` document) and `StoredPlayer`. `encodeHiscoreEntry` and
  `decodeHiscoreEntries` convert between it and the domain (`hiscoreLayoutIds` lists the layouts to load first,
  `UnknownHiscoreLayoutError` names a missing one), `layoutId` and `createHiscoreLayout` make layouts, and
  `hiscoreEntriesWriteExpression` is the aggregation expression that prepends an entry and strips unchanged values from
  the previous one for the same offset (`stripUnchangedValues` does the same in TypeScript). About 87% smaller than
  storing Jagex's JSON.
- `SkillEnum`, `ActivityEnum`, `calculateXPForSkillLevel` and `calculateXPToNextLevel` moved here from
  `@osrs-tracker/hiscores` (which re-exports them from 4.0.0), with `XP_TABLE` and `levelForXp` (a binary search instead
  of a loop per level).
- `"sideEffects": false`, so bundlers drop what isn't imported. Still no runtime dependencies.

## 1.0.0 - 2026-10-09

- First stable release: the models are unchanged from 0.10.3, and 1.0.0 marks their API as stable. From here, a breaking
  change to a model is a major version. Consumers on `^0.10.x` need to widen their range to `^1.0.0` to get it.

## 0.10.3 - 2026-10-09

- Licensed under Apache-2.0 instead of MIT, with a `NOTICE` file that copies must keep. Earlier versions stay MIT. The
  tarball now holds only `dist/`, the README, `CHANGELOG.md`, `LICENSE` and `NOTICE` (no more `src/`, tests or configs).

## 0.10.2 - 2026-10-09

- Corrected the `Player.lastModified` doc comment: osrs-tracker-api's refresh interval is now named
  `MIN_PLAYER_REFRESH_HOURS` (was `minPlayerRefreshTime`). Doc-only.

## 0.10.1 - 2026-10-08

- Fixed importing the package from Node's ES modules (`import` in an `.mjs` file or `"type": "module"` project), which
  failed with `ERR_MODULE_NOT_FOUND` because `dist/esm` used extensionless imports. Relative imports now end in `.js`
  and `dist/esm` has its own `package.json` with `"type": "module"`, like `@osrs-tracker/hiscores` 3.1.1. `types` is
  listed first in `exports`, and declarations are only in `dist/types` (no longer copied into `dist/cjs` and
  `dist/esm`). No API change; `require` and bundlers work as before.

## 0.10.0 - 2026-10-08

- **Breaking:** removed the deprecated `HiscoreEntry.sourceString`. Hiscore entries hold only `skills` and `activities`;
  no stored entry has had the string since the 2026-10-08 migration. Stop writing it (it was set to `'LEGACY'`) and use
  `@osrs-tracker/hiscores` 3.0.0, which no longer parses it.

## 0.9.1 - 2026-10-07

- Corrected the `Player.lastHiscoreFetch` doc comment: it is the last visitor lookup (ordering the recent players list),
  not the last hiscores scrape, and exists on any looked-up stored player, tracked or not. The last scrape is the newest
  `hiscoreEntries` entry's `date` for the offset. Clarified `Player.lastModified` too. Doc-only.

## 0.9.0 - 2026-10-07

- Added response-only `Player.trackedSince` (date of the oldest stored hiscore entry for the requested scraping offset)
  and `Player.refreshFailed` (the hiscores didn't respond, so the data may be stale). Both are set by osrs-tracker-api's
  `GET /players/:username` and never stored.

## 0.8.0 - 2026-10-02

- Added `Player.pausedScrapingOffsets`, `Player.hiscoreNotFoundCount` and `Player.hiscoreNotFoundSince`. Scraping is
  paused (offsets moved to `pausedScrapingOffsets`) when a player hasn't been on the hiscores for 7 days in a row, and
  resumed when the player is found again.

## 0.7.1 - 2025-09-22

- Fixed `HiscoreSkill` to have `xp` instead of `experience` field. This was a typo in the previous release.

## 0.7.0 - 2025-09-22

- Marked `HiscoreEntry.sourceString` as a deprecated field.
- Added `HiscoreEntry.skills` and `HiscoreEntry.activities` fields to replace `sourceString`. These fields come from the
  json response from the hiscores API and provide a more structured representation of the player's skills and
  activities.

## 0.6.0 - 2025-04-19

- Added support for both `esm` and `cjs` module formats.

## 0.5.1 - 2025-03-29

- Fix `package-lock.json` mismatch.

## 0.5.1 - 2025-03-29

- Added `lastFetch` to `Item`.

## 0.5.0 - 2025-03-29

- Added `lastHiscoreFetch` to `Player`.

## 0.4.0 - 2023-08-19

- Update `typescript` to `^5.1.6`.
- Changed from classes to interfaces because it makes more sense.

## 0.3.3 - 2023-04-07

- Remove`latest` from `Item`.

## 0.3.2 - 2023-04-01

- Made `pubDate` not nullable.

## 0.3.1 - 2023-04-01

- Added `OsrsNewsItem` to models.

## 0.2.0 - 2023-03-19

- Update `Item` to `prices.runescape.wiki/api` models.

## 0.1.0 - 2023-03-19

- Added `combatLevel: number` to `Player`
- Combined `Player` and `PlayerWithHiscores`.

## 0.0.3 - 2023-03-16

- made `scrapingOffsets` and `hiscoreEntries` optional. These fields only exist when the player is being tracked.

## 0.0.2 - 2023-03-16

- moved `scrapingOffsets: number[]` from `PlayerWithHiscores` to `Player`
- removed `HiscoreEntry` constructor.
