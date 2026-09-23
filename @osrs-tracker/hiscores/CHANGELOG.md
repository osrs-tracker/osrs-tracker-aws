## v2.1.1 - 2026/09/24

- Fixed wrong order in ActivityEnum.

## v2.1.0 - 2026/09/23

- Added coverage for parser helpers including `parseHiscores`, `hiscoreDiff`, `getOverallXpDiff`, and
  `hiscoreJsonToSourceString`.
- Improved hiscore parsing and diff behavior around source-string fallback, overall XP deltas, and JSON-to-source
  conversion.
- Cleaned up hiscore model/export usage in the package to align with the current parsed hiscore structure.

## v2.0.1 - 2026/09/22

- Updated `@osrs-tracker/models` to `^0.7.1` to fix typo in `HiscoreSkill` interface.

## v2.0.0 - 2026/09/22

# BREAKING CHANGES

- Removed specific types for activities and replaced them with a generic `Activity` type. This change allows for more
  flexibility in handling various activities without the need for predefined types. Also conforms more with the json
  format of the hiscores.

## v1.3.0 - 2026/07/29

- Added new hiscore parse order for Mad Angel.

## v1.2.0 - 2026/06/30

- Added new hiscore parse order for Maggot King.

## v1.1.0 - 2026/02/25

- Added new hiscore parse order for Brutus (Cow Boss).

## v1.0.1 - 2025/11/19

- Fix issue in hiscoreDiff caused by new skill not existing in previous hiscore (Sailing).

## v1.0.0 - 2025/11/16

- Added new hiscore parse order for Sailing.

### BREAKING CHANGES

- Add missing space to `RaidEnum` value for`TheGauntlet`.
- Changed `Hiscore` key for minigames from `miniGames` to `minigames`.

## v0.11.0 - 2025/11/05

- Added new hiscore parse order for Sailing pre-release (Shellbane Gryphon).

## v0.10.0 - 2025/10/15

- Added new hiscore parse order for Grid Master release.

## v0.9.0 - 2025/07/23

- Added new hiscore parse order for Varlamore Part 3.

## v0.8.0 - 2025/05/14

- Added new hiscore parse order for Yama.

## v0.7.1 - 2025/04/13

- Updated dependencies for compatibility with the latest version of `@osrs-tracker/models`.

## v0.7.0 - 2025/01/29

- Added new hiscore parse order for The Royal Titans.

## v0.6.0 - 2025/01/29

- Added new hiscore parse order for Collection Log.

## v0.5.0 - 2024/09/25

- Added new hiscore parse order for Varlamore Part 2.

## v0.4.0 - 2024/03/20

- Added new hiscore parse order for Araxxor

## v0.3.0 - 2024/03/20

- Added new hiscore parse order for Varlamore Part 1.

## v0.2.0 - 2024/02/27

- Added methods for XP calculation
  - `calculateXPForSkillLevel(level: number): number`
  - `calculateXPToNextLevel(currentXP: number, currentLevel: number)`

## v0.1.3 - 2023/09/11

- Add scurrius to parser to fix parser.

## v0.1.2 - 2023/09/11

- Fix bad DT2 boss parsing order.

## v0.1.1 - 2023/08/24

- Used correct start date for new parser.

## v0.1.0 - 2023/08/24

- Added support for the new Deadman Apocalypse hiscore changes.

## v0.0.2 - 2023/08/19

- Made `@osrs-tracker/models` a devDependency instead of regular dependency.

## v0.0.1 - 2023/08/19

- Initial release
