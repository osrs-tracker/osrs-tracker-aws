# @osrs-tracker/models &middot; [![NPM package](https://img.shields.io/npm/v/@osrs-tracker/models.svg)](https://www.npmjs.com/package/@osrs-tracker/models) [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/main/LICENSE)

The shared TypeScript types for [OSRS Tracker](https://osrs-tracker.freekmencke.com): players, hiscores, items and news,
plus the code that stores hiscore entries compactly. They're used by the website, the API and the background jobs, so
all of them agree on the shape of the data. Works with both ES modules and CommonJS, in Node and the browser, with no
runtime dependencies.

## Install

```bash
npm install @osrs-tracker/models
```

## Usage

```ts
import { Item, Player } from '@osrs-tracker/models';

function describe(player: Player): string {
  return `${player.username} has ${player.hiscoreEntries?.length ?? 0} hiscore snapshots`;
}
```

### Stored hiscore entries

Entries are stored by position in a layout (the skill and activity names Jagex used), and a value that didn't change
since the entry before is stored as its bare rank. Writers encode and prepend; readers load the layouts and decode:

```ts
import {
  createHiscoreLayout,
  decodeHiscoreEntries,
  encodeHiscoreEntry,
  hiscoreEntriesWriteExpression,
} from '@osrs-tracker/models';

const layout = createHiscoreLayout(names, new Date()); // upsert it in `hiscoreLayouts` before the entry
await players.updateOne({ username }, [
  { $set: { hiscoreEntries: hiscoreEntriesWriteExpression(encodeHiscoreEntry(entry, layout)) } },
]);

const entries = decodeHiscoreEntries(player.hiscoreEntries, layoutsById); // newest first, as stored
```

### Reading entries

A value is `null` when there's no xp or score; don't make up a value for it. Show an untrained skill's level with
`skillLevel(entry.skills[name])` (1), or its level, xp and progress with `skillProgress(entry.skills[name])`, read
Overall with `overallOf(entry)`, and iterate a `HiscoreDiff` with `Object.entries`: its values are never `null`.

### Enums and XP

`SkillEnum` and `ActivityEnum` hold skill and activity names exactly as the `name` in Jagex's JSON hiscores
(`SkillEnum.Overall` is `'Overall'`, `ActivityEnum.LastManStanding` is `'LMS - Rank'`). Entries are keyed by those
names, and a name Jagex adds is stored before the enums know it, so the enums list only the names code refers to.
`PlayerType` and `PlayerStatus` are a `Player`'s `type` (`normal`, `ironman`, …) and `status` (`default`, `de_ironed`,
`de_ultimated`).

`XP_TABLE[level]` is the total xp a level needs, from 1 to 126; `calculateXPForSkillLevel(level)` returns the same and
keeps applying the formula above 126. `calculateXPToNextLevel(xp, level)` and `percentageToNextLevel(xp, level)` measure
progress into a level, and `levelForXp(xp)` returns the level, capped at `MAX_SKILL_LEVEL` (99).

## Development

OSRS Tracker was originally built entirely without AI assistance. Since October 2026, I've started using
[Claude](https://claude.com/claude-code), Anthropic's AI coding assistant, to help improve development speed and
reliability.
