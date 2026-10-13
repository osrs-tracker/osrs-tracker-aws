## 4.2.0 - 2026-10-13

- `fetchWorldList` and `parseWorldList` count the players online from Jagex's world list (`WORLD_LIST_URL`, the binary
  list the game client's World Select uses), moved here from the record-player-count Lambda so osrs-tracker-api can
  serve a live count with the same parser. `parseWorldList` returns a `WorldListCounts` (models' `PlayerCount` without
  `date`) and throws when the response doesn't match the format. `fetchWorldList` takes `fetch`, `timeoutMs` (default 10
  seconds) and `userAgent` options like `getHiscore`, but throws on failure. Node only: the world list sends no CORS
  headers.
- Requires `@osrs-tracker/models` `^2.4.0`, for `PlayerCount`.
- README: the `hiscoreDiff` example says a missing skill counts as level 1 and the result is a `HiscoreDiff`.

## 4.1.0 - 2026-10-10

- `hiscoreDiff` returns models' `HiscoreDiff`, whose values are typed as numbers (never `null`), so code reading a diff
  needs no fallbacks. The values are the same as in 4.0.0; a skill without xp still counts as level 1, now through
  models' `skillLevel`. Requires `@osrs-tracker/models` `^2.1.0`.

## 4.0.0 - 2026-10-10

- **Breaking:** `getHiscore` returns hiscores mapped to `@osrs-tracker/models` 2.0.0's `HiscoreEntry` (keyed by name,
  `rank: null` when unranked, `null` when there's no value, Overall never `null`) plus the `layout` names in Jagex's
  order. The new `fromJagex` does the same mapping for a raw `index_lite.json` (`JagexHiscoreJson`, formerly
  `HiscoreJson`) and needs no Node APIs, so a browser can map live hiscores too. It maps by name, so skills and
  activities Jagex adds come through before the enums know them.
- **Breaking:** `hiscoreDiff` and `getOverallXpDiff` take keyed entries, cover the union of both entries' names, count
  `null` or a missing value as 0 (a skill's level as 1), and diff levels too. Every value in the result is a number.
- `SkillEnum`, `ActivityEnum`, `calculateXPForSkillLevel` and `calculateXPToNextLevel` moved to models and are
  re-exported here, with `levelForXp` and `XP_TABLE`, so imports from hiscores keep working.
- Requires `@osrs-tracker/models` `^2.0.0`: the domain types changed shape, so older models can't work.
- README: lists `getHiscore`'s options with their defaults (`table` with the full table names, `fetch`, `timeoutMs`) and
  says it never throws; describes the domain shape and `fromJagex`.

## 3.1.3 - 2026-10-09

- The `@osrs-tracker/models` peer range also accepts `^1.0.0`. No code change.

## 3.1.2 - 2026-10-09

- Licensed under Apache-2.0 instead of MIT, with a `NOTICE` file that copies must keep. Earlier versions stay MIT. The
  tarball now holds only `dist/`, the README, `CHANGELOG.md`, `LICENSE` and `NOTICE` (no more `src/`, tests or configs).

## 3.1.1 - 2026-10-08

- Fixed loading the package in plain Node (e.g. `nest start`), which failed with `ERR_MODULE_NOT_FOUND` because `dist`
  was ES module syntax with extensionless imports. It now ships a CommonJS build (`dist/cjs`), an ES module build that
  Node can import (`dist/esm`) and the types (`dist/types`), with an `exports` map, like `@osrs-tracker/models`. No API
  change.

## 3.1.0 - 2026-10-08

- Added `getHiscore({ baseUrl, username, table?, fetch?, timeoutMs? })`, the hiscore HTTP client the API and the
  process-players Lambda each had their own copy of. It returns `found` (with Jagex's JSON), `notFound` (HTTP 404/400,
  don't retry) or `failed` (other non-2xx, network error, timeout or a body without `skills`/`activities` arrays, with a
  `reason` to log). It URL-encodes the name, covers the four `HiscoreTable`s, never throws, doesn't log and doesn't read
  `process.env`. Uses the global `fetch` unless you pass one (e.g. `node-fetch` with your own agent).

## 3.0.0 - 2026-10-08

- **Breaking:** removed parsing of the old CSV-like hiscore string, now that every stored entry has `skills` and
  `activities` (the string was migrated away on 2026-10-08): `parseHiscores`, `parseHiscoreString`,
  `hiscoreJsonToSourceString`, every dated parse order and the `date-fns` dependency are gone. Use the entries'
  `skills`/`activities` directly where you called `parseHiscores`. A new skill, boss or activity now only needs its
  `SkillEnum`/`ActivityEnum` member.
- `getOverallXpDiff` reads `skills` only.
- Changed the `@osrs-tracker/models` peer dependency to `^0.9.0 || ^0.10.0` (models 0.10.0 drops
  `HiscoreEntry.sourceString`). Models 0.8 is no longer accepted.
- Overrode `js-yaml` to `^4.1.0` under `@istanbuljs/load-nyc-config` (pulled in by `ts-jest`), dropping `sprintf-js`
  (GHSA-hp3w-g68c-fv3c, no patched release). Dev-only, so the published package is unchanged.

## 2.1.6 - 2026-10-07

- Upgraded the `@osrs-tracker/models` dev dependency to `^0.9.1` (doc comment fix). No code changes.

## 2.1.5 - 2026-10-07

- Changed the `@osrs-tracker/models` peer dependency to `^0.8.0 || ^0.9.0`, so it can be installed together with models
  0.9.0. Models 0.7 is no longer accepted.
- Upgraded `jest` to `^30.5.2` and `ts-jest` to `^29.4.14`, and ran `npm audit fix`, clearing all 35 dev dependency
  vulnerabilities. Dev-only, so the published package is unchanged.

## 2.1.4 - 2026-10-02

- Widened the `@osrs-tracker/models` peer dependency to `^0.7.1 || ^0.8.0`, so it can be installed together with models
  0.8.0.

## 2.1.3 - 2026-09-26

- Kept the hiscore activity ordering aligned with the current OSRS parse expectations.

## 2.1.2 - 2026-09-24

- Fixed wrong order in ActivityEnum.

## 2.1.1 - 2026-09-24

- Fixed wrong order in ActivityEnum.

## 2.1.0 - 2026-09-23

- Added coverage for parser helpers including `parseHiscores`, `hiscoreDiff`, `getOverallXpDiff`, and
  `hiscoreJsonToSourceString`.
- Improved hiscore parsing and diff behavior around source-string fallback, overall XP deltas, and JSON-to-source
  conversion.
- Cleaned up hiscore model/export usage in the package to align with the current parsed hiscore structure.

## 2.0.1 - 2026-09-22

- Updated `@osrs-tracker/models` to `^0.7.1` to fix typo in `HiscoreSkill` interface.

## 2.0.0 - 2026-09-22

# BREAKING CHANGES

- Removed specific types for activities and replaced them with a generic `Activity` type. This change allows for more
  flexibility in handling various activities without the need for predefined types. Also conforms more with the json
  format of the hiscores.

## 1.3.0 - 2026-07-29

- Added new hiscore parse order for Mad Angel.

## 1.2.0 - 2026-06-30

- Added new hiscore parse order for Maggot King.

## 1.1.0 - 2026-02-25

- Added new hiscore parse order for Brutus (Cow Boss).

## 1.0.1 - 2025-11-19

- Fix issue in hiscoreDiff caused by new skill not existing in previous hiscore (Sailing).

## 1.0.0 - 2025-11-16

- Added new hiscore parse order for Sailing.

### BREAKING CHANGES

- Add missing space to `RaidEnum` value for`TheGauntlet`.
- Changed `Hiscore` key for minigames from `miniGames` to `minigames`.

## 0.11.0 - 2025-11-05

- Added new hiscore parse order for Sailing pre-release (Shellbane Gryphon).

## 0.10.0 - 2025-10-15

- Added new hiscore parse order for Grid Master release.

## 0.9.0 - 2025-07-23

- Added new hiscore parse order for Varlamore Part 3.

## 0.8.0 - 2025-05-14

- Added new hiscore parse order for Yama.

## 0.7.1 - 2025-04-13

- Updated dependencies for compatibility with the latest version of `@osrs-tracker/models`.

## 0.7.0 - 2025-01-29

- Added new hiscore parse order for The Royal Titans.

## 0.6.0 - 2025-01-29

- Added new hiscore parse order for Collection Log.

## 0.5.0 - 2024-09-25

- Added new hiscore parse order for Varlamore Part 2.

## 0.4.0 - 2024-03-20

- Added new hiscore parse order for Araxxor

## 0.3.0 - 2024-03-20

- Added new hiscore parse order for Varlamore Part 1.

## 0.2.0 - 2024-02-27

- Added methods for XP calculation
  - `calculateXPForSkillLevel(level: number): number`
  - `calculateXPToNextLevel(currentXP: number, currentLevel: number)`

## 0.1.3 - 2023-09-11

- Add scurrius to parser to fix parser.

## 0.1.2 - 2023-09-11

- Fix bad DT2 boss parsing order.

## 0.1.1 - 2023-08-24

- Used correct start date for new parser.

## 0.1.0 - 2023-08-24

- Added support for the new Deadman Apocalypse hiscore changes.

## 0.0.2 - 2023-08-19

- Made `@osrs-tracker/models` a devDependency instead of regular dependency.

## 0.0.1 - 2023-08-19

- Initial release
