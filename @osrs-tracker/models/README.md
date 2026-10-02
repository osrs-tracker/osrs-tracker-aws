# @osrs-tracker/models &middot; [![NPM package](https://img.shields.io/npm/v/@osrs-tracker/models.svg)](https://www.npmjs.com/package/@osrs-tracker/models) [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/main/LICENSE)

The shared TypeScript types for [OSRS Tracker](https://osrs-tracker.freekmencke.com): players, hiscores, items and news.
They're used by the website, the API and the background jobs, so all of them agree on the shape of the data. Works with
both ES modules and CommonJS.

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

## Development

OSRS Tracker was originally built entirely without AI assistance. Since October 2026, I've started using
[Claude](https://claude.com/claude-code), Anthropic's AI coding assistant, to help improve development speed and
reliability.
