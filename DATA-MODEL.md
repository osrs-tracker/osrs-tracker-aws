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

| Field                                             | Written by                                                                                                                                                                                                         | Read by                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `username`                                        | API, on upsert in `refreshPlayerInfo`: normalized, and only valid OSRS names. Never changed after that.                                                                                                            | Everyone (the filter for every per-player read and write).                       |
| `combatLevel`, `type`, `status`, `diedAsHardcore` | API `refreshPlayerInfo`, from the four hiscore tables.                                                                                                                                                             | API, web.                                                                        |
| `lastModified`                                    | API `refreshPlayerInfo`: when the type and status were last determined.                                                                                                                                            | API (refresh at most every `MIN_PLAYER_REFRESH_HOURS` = 2, and `Cache-Control`). |
| `lastHiscoreFetch`                                | API `recordLookup` (`POST /players/:username/lookup`): when a visitor last looked the player up. Never set on insert, so players nobody looked up lack it.                                                         | API recent players list.                                                         |
| `scrapingOffsets`                                 | API `refreshPlayerInfo` adds the requested offset (`$setUnion` with any `pausedScrapingOffsets`). process-players removes the field when it pauses the player. Nothing else removes offsets.                       | queue-players (which players to queue each hour), API.                           |
| `pausedScrapingOffsets`                           | process-players sets it when it pauses the player. API `refreshPlayerInfo` merges it back and unsets it.                                                                                                           | API (a paused player still counts as tracked).                                   |
| `hiscoreNotFoundCount`, `hiscoreNotFoundSince`    | process-players sets them on a 404/400 hiscore and unsets them on the next scraped entry. API `refreshPlayerInfo` also unsets them.                                                                                | process-players.                                                                 |
| `hiscoreEntries`                                  | process-players prepends one entry per scrape. API `refreshPlayerInfo` prepends an initial entry when the player didn't have the requested offset. clean-hiscores pulls entries older than `MAX_AGE_IN_DAYS` (60). | API, web.                                                                        |
| `trackedSince`, `refreshFailed`                   | Never stored: computed per response by the API.                                                                                                                                                                    | Web.                                                                             |

`hiscoreEntries` is stored **newest first**: both writers prepend (`$position: 0` in process-players, `$concatArrays` in
the API's `buildRefreshUpdate`, `api:src/features/players/player.policy.ts`). The API depends on that order: it takes
the first matching entry as the latest and the last as `trackedSince`. A few players have one entry out of order (see
[Stored data](#stored-data)).

Each entry:

| Field                  | Notes                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `date`                 | Scrape time. One time per process-players SQS message, so every player in a message shares it.                                   |
| `scrapingOffset`       | The offset it was scraped for. Usually one entry per offset per day (the API's initial entry can add a second on the first day). |
| `skills`, `activities` | Parsed hiscores (JSON hiscores API). Activity `id` is the position in the list, as the JSON hiscores give it.                    |

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
- A few older API initial entries carry an extra `name` (not in the models, no longer written). clean-hiscores ages them
  out.
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
- **Out-of-order entries**: 3 players have one entry stored after older entries (appended by older API code). They age
  out by about 2026-12-01.
- **Size**: Atlas's free tier allows 512 MB of uncompressed data plus indexes. An entry is about 7.4 KB; 60 days of
  entries for today's tracked players settles near 240 MB, so about double the tracked players would reach the limit.
- **`items`**: `limit`, `lowalch`, `highalch` and `value` are missing on some items (the Wiki omits them).
