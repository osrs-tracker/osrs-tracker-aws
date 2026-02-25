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
