## 1.0.0 - 2026/10/09

- First stable release: the models are unchanged from 0.10.3, and 1.0.0 marks their API as stable. From here, a breaking
  change to a model is a major version. Consumers on `^0.10.x` need to widen their range to `^1.0.0` to get it.

## 0.10.3 - 2026/10/09

- Licensed under Apache-2.0 instead of MIT, with a `NOTICE` file that copies must keep. Earlier versions stay MIT. The
  tarball now holds only `dist/`, the README, `CHANGELOG.md`, `LICENSE` and `NOTICE` (no more `src/`, tests or configs).

## 0.10.2 - 2026/10/09

- Corrected the `Player.lastModified` doc comment: osrs-tracker-api's refresh interval is now named
  `MIN_PLAYER_REFRESH_HOURS` (was `minPlayerRefreshTime`). Doc-only.

## 0.10.1 - 2026/10/08

- Fixed importing the package from Node's ES modules (`import` in an `.mjs` file or `"type": "module"` project), which
  failed with `ERR_MODULE_NOT_FOUND` because `dist/esm` used extensionless imports. Relative imports now end in `.js`
  and `dist/esm` has its own `package.json` with `"type": "module"`, like `@osrs-tracker/hiscores` 3.1.1. `types` is
  listed first in `exports`, and declarations are only in `dist/types` (no longer copied into `dist/cjs` and
  `dist/esm`). No API change; `require` and bundlers work as before.

## 0.10.0 - 2026/10/08

- **Breaking:** removed the deprecated `HiscoreEntry.sourceString`. Hiscore entries hold only `skills` and `activities`;
  no stored entry has had the string since the 2026-10-08 migration. Stop writing it (it was set to `'LEGACY'`) and use
  `@osrs-tracker/hiscores` 3.0.0, which no longer parses it.

## 0.9.1 - 2026/10/07

- Corrected the `Player.lastHiscoreFetch` doc comment: it is the last visitor lookup (ordering the recent players list),
  not the last hiscores scrape, and exists on any looked-up stored player, tracked or not. The last scrape is the newest
  `hiscoreEntries` entry's `date` for the offset. Clarified `Player.lastModified` too. Doc-only.

## 0.9.0 - 2026/10/07

- Added response-only `Player.trackedSince` (date of the oldest stored hiscore entry for the requested scraping offset)
  and `Player.refreshFailed` (the hiscores didn't respond, so the data may be stale). Both are set by osrs-tracker-api's
  `GET /players/:username` and never stored.

## 0.8.0 - 2026/10/02

- Added `Player.pausedScrapingOffsets`, `Player.hiscoreNotFoundCount` and `Player.hiscoreNotFoundSince`. Scraping is
  paused (offsets moved to `pausedScrapingOffsets`) when a player hasn't been on the hiscores for 7 days in a row, and
  resumed when the player is found again.

## 0.7.1 - 2025/09/22

- Fixed `HiscoreSkill` to have `xp` instead of `experience` field. This was a typo in the previous release.

## 0.7.0 - 2025/09/22

- Marked `HiscoreEntry.sourceString` as a deprecated field.
- Added `HiscoreEntry.skills` and `HiscoreEntry.activities` fields to replace `sourceString`. These fields come from the
  json response from the hiscores API and provide a more structured representation of the player's skills and
  activities.

## 0.6.0 - 2025/04/19

- Added support for both `esm` and `cjs` module formats.

## 0.5.1 - 2025/03/29

- Fix `package-lock.json` mismatch.

## 0.5.1 - 2025/03/29

- Added `lastFetch` to `Item`.

## 0.5.0 - 2025/03/29

- Added `lastHiscoreFetch` to `Player`.

## 0.4.0 - 2023/08/19

- Update `typescript` to `^5.1.6`.
- Changed from classes to interfaces because it makes more sense.

## v0.3.3 - 2023/04/07

- Remove`latest` from `Item`.

## v0.3.2 - 2023/04/01

- Made `pubDate` not nullable.

## v0.3.1 - 2023/04/01

- Added `OsrsNewsItem` to models.

## v0.2.0 - 2023/03/19

- Update `Item` to `prices.runescape.wiki/api` models.

## v0.1.0 - 2023/03/19

- Added `combatLevel: number` to `Player`
- Combined `Player` and `PlayerWithHiscores`.

## v0.0.3 - 2023/03/16

- made `scrapingOffsets` and `hiscoreEntries` optional. These fields only exist when the player is being tracked.

## v0.0.2 - 2023/03/16

- moved `scrapingOffsets: number[]` from `PlayerWithHiscores` to `Player`
- removed `HiscoreEntry` constructor.
