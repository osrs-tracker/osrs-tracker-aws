# Data model

The `players` and `items` collections in MongoDB are written by two repos: the Lambdas in this repo and
[osrs-tracker-api](https://github.com/osrs-tracker/osrs-tracker-api). This file says which side writes each field and
owns each index, so a change on one side doesn't break the other. The TypeScript shapes are in
[`@osrs-tracker/models`](@osrs-tracker/models/src/models); this file covers who writes what and when.

When you add, rename or stop writing a field, or add, change or drop an index, update this file in the same change, and
open an issue in the other repo when it has to follow.

Paths below are relative to each repo: `aws:` is this repo, `api:` is osrs-tracker-api.

## `players`

One document per tracked or looked-up player, keyed by `username`.

| Field                                             | Written by                                                                                                                                                                                                                                                                                                                                                                                                                                               | Read by                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `username`                                        | API, on upsert in `refreshPlayerInfo`: normalized the way Jagex matches names (lowercase, `_` and `-` as spaces, trimmed; repeated separators aren't collapsed), so it never contains `_` or `-`, and only valid OSRS names (`api:src/features/players/player.utils.ts`). Never changed after that, except by a one-off migration on 2026/10/09 that renamed the names stored with `_` or `-`, or merged them into the already stored normalized player. | Everyone (the filter for every per-player read and write).                       |
| `combatLevel`, `type`, `status`, `diedAsHardcore` | API `refreshPlayerInfo`, from the four hiscore tables.                                                                                                                                                                                                                                                                                                                                                                                                   | API, web.                                                                        |
| `lastModified`                                    | API `refreshPlayerInfo`: when the type and status were last determined.                                                                                                                                                                                                                                                                                                                                                                                  | API (refresh at most every `MIN_PLAYER_REFRESH_HOURS` = 2, and `Cache-Control`). |
| `lastHiscoreFetch`                                | API `recordLookup` (`POST /players/:username/lookup`): when a visitor last looked the player up. Never set on insert, so players nobody looked up lack it.                                                                                                                                                                                                                                                                                               | API recent players list.                                                         |
| `scrapingOffsets`                                 | API `refreshPlayerInfo` adds the requested offset (`$setUnion` with any `pausedScrapingOffsets`). process-players removes the field when it pauses the player. Nothing else removes offsets.                                                                                                                                                                                                                                                             | queue-players (which players to queue each hour), API.                           |
| `pausedScrapingOffsets`                           | process-players sets it when it pauses the player. API `refreshPlayerInfo` merges it back and unsets it.                                                                                                                                                                                                                                                                                                                                                 | API (a paused player still counts as tracked).                                   |
| `hiscoreNotFoundCount`, `hiscoreNotFoundSince`    | process-players sets them on a 404/400 hiscore and unsets them on the next scraped entry. API `refreshPlayerInfo` also unsets them.                                                                                                                                                                                                                                                                                                                      | process-players.                                                                 |
| `hiscoreEntries`                                  | process-players prepends one entry per scrape. API `refreshPlayerInfo` prepends an initial entry when the player didn't have the requested offset. clean-hiscores pulls entries older than `MAX_AGE_IN_DAYS` (60).                                                                                                                                                                                                                                       | API, web.                                                                        |
| `trackedSince`, `refreshFailed`                   | Never stored: computed per response by the API.                                                                                                                                                                                                                                                                                                                                                                                                          | Web.                                                                             |

`hiscoreEntries` is stored **newest first** in a compact format (since 2026-10-10, roadmap
osrs-tracker/osrs-tracker-aws#52). Both writers prepend with `hiscoreEntriesWriteExpression` from `@osrs-tracker/models`
(a pipeline update: process-players' bulk write, and the API's `buildRefreshUpdate` in
`api:src/features/players/player.policy.ts`), and readers decode with `decodeHiscoreEntries`. Bare values only point to
newer entries, so readers must decode from the newest entry, and the order matters: the API takes the first matching
entry as the latest and the last as `trackedSince`.

Each entry:

| Field | Notes                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `d`   | Date: scrape time. One time per process-players SQS message, so every player in a message shares it.                                       |
| `o`   | Scraping offset. Usually one entry per offset per day (the API's initial entry can add a second on the first day).                         |
| `l`   | Layout id: `_id` in [`hiscoreLayouts`](#hiscorelayouts), the skill and activity names the values are positioned by.                        |
| `s`   | Skills by position in the layout. Index 0 (Overall) is always `[rank or null, level, xp]`; other levels are derived from xp when decoding. |
| `a`   | Activities by position in the layout.                                                                                                      |

A value is `[rank, xp]` / `[rank, score]` (`rank` is `null` when unranked: the value is below Jagex's ranking cut-off),
`null` (no xp or score), or bare: a bare `rank` (or `0` when unranked) means "the same xp or score as this name in the
next newer entry with the same `o`". The write expression creates bare values: when it prepends an entry, it strips the
previous newest entry with the same `o` (wherever it is in the array), only if it also has the same `l`. So the newest
entry per offset is always stored in full, and clean-hiscores pulling the oldest entries never breaks a bare value.

Scraping offsets are hours relative to UTC midnight, -12 to +11 (the API rejects anything else). queue-players also
queues offset `12` together with `-12` (the same time); nothing writes `12`.

### Pause/resume contract

A player who's off the hiscores (renamed, banned or unranked) shouldn't be scraped forever, but must come back when
found again.

1. **The Lambda counts 404s.** Only process-players counts. On a 404 or 400 hiscore it sets `hiscoreNotFoundSince` (if
   not set) and increments `hiscoreNotFoundCount` (`MU.recordHiscoreNotFound`). The streak is date-based: once
   `hiscoreNotFoundSince` is 7 days old (`HISCORE_NOT_FOUND_PAUSE_DAYS`), it moves `scrapingOffsets` into
   `pausedScrapingOffsets` and removes `scrapingOffsets`, so queue-players stops queueing the player. History is kept.
2. **A successful scrape ends the streak.** process-players unsets `hiscoreNotFoundCount` and `hiscoreNotFoundSince`
   when it stores an entry.
3. **The API resumes.** A successful `refreshPlayerInfo` merges `pausedScrapingOffsets` (and the requested offset) into
   `scrapingOffsets` and unsets `pausedScrapingOffsets`, `hiscoreNotFoundSince` and `hiscoreNotFoundCount`.
4. **The API never counts.** A refresh that isn't successful (404 or hiscores outage) writes nothing.

## `hiscoreLayouts`

One document per list of skill and activity names Jagex has used (one on 2026-10-10). A RuneScape update that adds a
skill or activity gives a new layout; older entries keep theirs.

| Field                  | Written by                                                                                                                                                                                               | Read by                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `_id`                  | `layoutId(skills, activities)` from models: 32-bit FNV-1a over the names, as a signed int32. Writers upsert the layout **before** the first entry using it and fail when an existing id has other names. | API (cached).                |
| `skills`, `activities` | `$setOnInsert` by process-players (`MU.ensureHiscoreLayouts`), the API, and once by the 2026-10-10 migration (a one-off script, removed since). Never changed after insert.                              | API, to decode entries.      |
| `since`                | `$setOnInsert` (the first writer's scrape time); the migration lowered it with `$min` to the oldest entry using it.                                                                                      | clean-hiscores' 1-day guard. |

clean-hiscores deletes layouts no entry uses that are older than a day (`since`), after its nightly pull (not on a night
it pulled nothing). The guard protects a layout whose first entry is still being written.

## `items`

One document per OSRS item, keyed by `id`.

| Field                                                                               | Written by                                                                                                                                                                     | Read by                |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `id`, `name`, `examine`, `icon`, `members`, `value`, `limit`, `lowalch`, `highalch` | refresh-items, every hour: upserts each item from the OSRS Wiki `mapping` endpoint with `$set` of the whole object. A field the Wiki omits for an item keeps its stored value. | API, web.              |
| `lastFetch`                                                                         | API `recordLookup` (`POST /items/:id/lookup`): when a visitor last looked the item up. Only on existing items.                                                                 | API recent items list. |

Items are never deleted: an item the Wiki drops keeps its last data.

## Indexes

One owner per index. The owner creates it; everyone else may rely on it (`hint`) but shouldn't create it.

| Collection | Index                                           | Owner (creates it)                                                                 | Relied on by                                                                                                                          |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `players`  | `{ username: 1 }`, unique                       | API, at startup (`api:src/common/mongo/mongo.provider.ts`)                         | API `hint` in `getPlayer`, `recordLookup`, `refreshPlayerInfo`; process-players `hint` in its bulk write and `recordHiscoreNotFound`. |
| `players`  | `{ lastHiscoreFetch: -1 }`, partial (`$exists`) | API, at startup                                                                    | API `getLastFetchedPlayers` (`hint`).                                                                                                 |
| `players`  | `{ scrapingOffsets: 1 }`, sparse                | queue-players, on every run (`aws:lambda/osrs-tracker_queue-players/src/index.ts`) | queue-players `getAllUsernamesForOffset` (`hint`).                                                                                    |
| `items`    | `{ id: 1 }`, unique                             | API, at startup                                                                    | API `getItem`, `recordLookup` (`hint`); refresh-items upsert (`hint`).                                                                |
| `items`    | `{ name: 'text' }`                              | API, at startup                                                                    | API `searchItems` (`$text`).                                                                                                          |
| `items`    | `{ lastFetch: -1 }`, partial (`$exists`)        | API, at startup                                                                    | API `getLastFetchedItems` (`hint`).                                                                                                   |

A `hint` on a missing index fails the query, so don't drop an index without checking this table.

clean-hiscores' `$pull` runs over the whole collection without an index; that's expected for a nightly job.

## Where the models and storage differ

- `Item.members` is typed `true`; stored values are `true` or `false`.
- One player has `type: 'CLEARED'`, which isn't a `PlayerType`, with `lastModified` set to 1900 and no `combatLevel`: a
  record cleared by hand.
- Nothing checks stored documents against the models.

## Stored data

What the live database holds beyond what the code above writes. Recheck (read-only) when changing a writer.

- **`players` without tracking**: a few players looked up before tracking existed have neither `hiscoreEntries` nor
  `scrapingOffsets`.
- **`scrapingOffsets: []`** on some players, from older code (current code always adds the requested offset).
  queue-players doesn't queue them and process-players won't pause them (it only pauses a non-empty `scrapingOffsets`);
  a lookup gives them an offset again.
- **Offsets in use**: -12, -6, -4, -3, 0, 1, 2, 3; 0 for over 90% of entries.
- **Size**: Atlas's free tier allows 512 MB of uncompressed data plus indexes. Since the compact format (2026-10-10), an
  entry is about 0.8 KB (24.2 MB for 31,822 entries of 514 players, was 223.9 MB); 60 days of entries for today's
  tracked players settles near 25 MB, so about ten times the tracked players fit. The migration also put the few
  out-of-order entries in date order and dropped the extra `name` some older API entries carried.
- **`items`**: `limit`, `lowalch`, `highalch` and `value` are missing on some items (the Wiki omits them).
