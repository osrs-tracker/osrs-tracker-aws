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
