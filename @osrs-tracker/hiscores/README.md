# @osrs-tracker/hiscores &middot; [![NPM package](https://img.shields.io/npm/v/@osrs-tracker/hiscores.svg)](https://www.npmjs.com/package/@osrs-tracker/hiscores) [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/main/LICENSE)

Parses Old School RuneScape hiscores for [OSRS Tracker](https://osrs-tracker.freekmencke.com). Jagex adds new skills,
bosses and activities from time to time, and this package knows the hiscore layout for every date since March 2023, so
old snapshots stay readable. It also compares snapshots and has a few helpers for XP calculations.

## Install

```bash
npm install @osrs-tracker/hiscores @osrs-tracker/models
```

## Usage

```ts
import { calculateXPForSkillLevel, hiscoreDiff, parseHiscoreString } from '@osrs-tracker/hiscores';

// Parse a raw hiscore string that was fetched on a given date
const { skills, activities } = parseHiscoreString(hiscoreString, new Date());

// What changed between two snapshots
const gains = hiscoreDiff(todayEntry, lastWeekEntry);

calculateXPForSkillLevel(99); // 13034431
```

## Development

OSRS Tracker was originally built entirely without AI assistance. Since October 2026, I've started using
[Claude](https://claude.com/claude-code), Anthropic's AI coding assistant, to help improve development speed and
reliability.
