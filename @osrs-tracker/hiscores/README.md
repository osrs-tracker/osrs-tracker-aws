# @osrs-tracker/hiscores &middot; [![NPM package](https://img.shields.io/npm/v/@osrs-tracker/hiscores.svg)](https://www.npmjs.com/package/@osrs-tracker/hiscores) [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/main/LICENSE)

Helpers for Old School RuneScape hiscores in [OSRS Tracker](https://osrs-tracker.freekmencke.com): the skill and
activity names, comparing two hiscore snapshots, and XP calculations. Snapshots come from Jagex's JSON hiscores as
`skills` and `activities` (see `HiscoreEntry` in `@osrs-tracker/models`).

## Install

```bash
npm install @osrs-tracker/hiscores @osrs-tracker/models
```

## Usage

```ts
import { calculateXPForSkillLevel, getOverallXpDiff, hiscoreDiff, SkillEnum } from '@osrs-tracker/hiscores';

// What changed between two snapshots
const gains = hiscoreDiff(todayEntry, lastWeekEntry);
const overallXpGained = getOverallXpDiff(todayEntry, lastWeekEntry);

calculateXPForSkillLevel(99); // 13034431
```

## Development

OSRS Tracker was originally built entirely without AI assistance. Since October 2026, I've started using
[Claude](https://claude.com/claude-code), Anthropic's AI coding assistant, to help improve development speed and
reliability.
