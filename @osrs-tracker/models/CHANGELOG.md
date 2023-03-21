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
