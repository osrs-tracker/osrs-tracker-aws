# @osrs-tracker/hiscores &middot; [![NPM package](https://img.shields.io/npm/v/@osrs-tracker/hiscores.svg)](https://www.npmjs.com/package/@osrs-tracker/hiscores) [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/main/LICENSE)

Helpers for Old School RuneScape hiscores in [OSRS Tracker](https://osrs-tracker.freekmencke.com): the skill and
activity names, comparing two hiscore snapshots, and XP calculations, plus a client for Jagex's JSON hiscores. Snapshots
come from Jagex's JSON hiscores as `skills` and `activities` (see `HiscoreEntry` in `@osrs-tracker/models`).

## Install

```bash
npm install @osrs-tracker/hiscores @osrs-tracker/models
```

## Usage

```ts
import { calculateXPForSkillLevel, getOverallXpDiff, hiscoreDiff } from '@osrs-tracker/hiscores';

// What changed between two snapshots
const gains = hiscoreDiff(todayEntry, lastWeekEntry);
const overallXpGained = getOverallXpDiff(todayEntry, lastWeekEntry);

calculateXPForSkillLevel(99); // 13034431
```

Fetching a hiscore (Node 18+ or a browser; pass `fetch` to use your own client). `getHiscore` never throws: every
outcome is a result.

```ts
import { getHiscore } from '@osrs-tracker/hiscores';

const result = await getHiscore({ baseUrl: 'https://secure.runescape.com', username: 'Lynx Titan' });
if (result.status === 'found') console.log(result.hiscore.skills);
else if (result.status === 'notFound')
  console.log('Not on the hiscores'); // HTTP 404/400, don't retry
else console.log(`Failed: ${result.reason}`); // worth retrying
```

Options: `table` (default `'hiscore_oldschool'`; `'hiscore_oldschool_ironman'`, `'hiscore_oldschool_ultimate'` or
`'hiscore_oldschool_hardcore_ironman'` for the ironman tables), `fetch` (default the global `fetch`) and `timeoutMs`
(default 10 seconds, after which the result is `failed`).

## Development

OSRS Tracker was originally built entirely without AI assistance. Since October 2026, I've started using
[Claude](https://claude.com/claude-code), Anthropic's AI coding assistant, to help improve development speed and
reliability.
