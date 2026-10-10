# @osrs-tracker/hiscores &middot; [![NPM package](https://img.shields.io/npm/v/@osrs-tracker/hiscores.svg)](https://www.npmjs.com/package/@osrs-tracker/hiscores) [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/main/LICENSE)

Helpers for Old School RuneScape hiscores in [OSRS Tracker](https://osrs-tracker.freekmencke.com): a client for Jagex's
JSON hiscores, the mapping from Jagex's JSON to the domain model (`HiscoreEntry` in `@osrs-tracker/models`), and
comparing two hiscore snapshots. The skill and activity names and the XP helpers live in `@osrs-tracker/models` and are
re-exported here.

A `HiscoreEntry` keys `skills` and `activities` by name. A value is `{ rank, level, xp }` / `{ rank, score }` with
`rank: null` when unranked (below Jagex's ranking cut-off) but with xp or a score, `null` when there's no xp or score,
and a missing key when the name wasn't on the hiscores. Overall is never `null`. Names Jagex adds come through before
`SkillEnum` or `ActivityEnum` know them: the enums are for looking up known names only.

## Install

```bash
npm install @osrs-tracker/hiscores @osrs-tracker/models
```

## Usage

```ts
import { calculateXPForSkillLevel, getOverallXpDiff, hiscoreDiff } from '@osrs-tracker/hiscores';

// What changed between two snapshots: the same keyed shape over both entries' names, `null` or missing counts as 0
const gains = hiscoreDiff(todayEntry, lastWeekEntry);
const overallXpGained = getOverallXpDiff(todayEntry, lastWeekEntry);

calculateXPForSkillLevel(99); // 13034431
```

Fetching a hiscore (Node 18+ or a browser; pass `fetch` to use your own client). `getHiscore` never throws: every
outcome is a result.

```ts
import { getHiscore } from '@osrs-tracker/hiscores';

const result = await getHiscore({ baseUrl: 'https://secure.runescape.com', username: 'Lynx Titan' });
if (result.status === 'found') {
  const entry = { date: new Date(), scrapingOffset: 0, ...result.hiscore }; // a HiscoreEntry
  console.log(entry.skills.Overall, result.layout.skills); // layout: the names in Jagex's order
} else if (result.status === 'notFound')
  console.log('Not on the hiscores'); // HTTP 404/400, don't retry
else console.log(`Failed: ${result.reason}`); // worth retrying
```

Options: `table` (default `'hiscore_oldschool'`; `'hiscore_oldschool_ironman'`, `'hiscore_oldschool_ultimate'` or
`'hiscore_oldschool_hardcore_ironman'` for the ironman tables), `fetch` (default the global `fetch`) and `timeoutMs`
(default 10 seconds, after which the result is `failed`).

Already have Jagex's `index_lite.json` (typed `JagexHiscoreJson`), e.g. from a proxy? Map it the same way:

```ts
import { fromJagex, JagexHiscoreJson } from '@osrs-tracker/hiscores';

const { skills, activities, layout } = fromJagex(json as JagexHiscoreJson);
```

## Development

OSRS Tracker was originally built entirely without AI assistance. Since October 2026, I've started using
[Claude](https://claude.com/claude-code), Anthropic's AI coding assistant, to help improve development speed and
reliability.
