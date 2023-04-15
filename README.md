# OSRS Tracker AWS &middot; [![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/master/LICENSE) [![GitHub issues](https://img.shields.io/github/issues/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/issues) &middot; [![CI](https://github.com/osrs-tracker/osrs-tracker-aws/actions/workflows/main.yml/badge.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/actions/workflows/main.yml)

This repository contains the AWS code and configuration for OSRS Tracker, an application designed to track item prices
and player information in the game Old School RuneScape.

## Lambda functions

### Schedule Driven

- **osrs-tracker_refresh-items**

  This function fetches all items and latest prices from `prices.runescape.wiki/api/v1/osrs`, merges them into an `Item`
  object and upserts all items to MongoDB every hour.

- **osrs-tracker_queue-players**

  This function fetches all players that have opted in for tracking at a particular UTC offset, and pushes them to a SQS
  queue where they will wait to be processed.

  Calculates current offset from the `ScheduledEvent` and queries MongoDB for players that have opted in for tracking at
  that specific offset.

- **osrs-tracker_process-players**

  This function fetches OSRS hiscores for the provided usernames, and prepends the hiscore to the
  `player.hiscoreEntries` array.

### API Gateway driven

- **osrs-tracker_item-info**

  When sending a `GET /:id` request, this function returns item details from MongoDB.

- **osrs-tracker_item-search**

  When sending a `GET /:query` request, this function returns items from MongoDB where the name partially matches the
  provided query. It also adds a confidence score property.

- **osrs-tracker_player-hiscores**

  When sending a `GET /:username(?size=7&skip=0&scrapingOffset=0)` request, this function returns scraped player
  `hiscoreEntries` for the provided username from MongoDB.

- **osrs-tracker_player-info**

  When sending a `GET /:username(?scrapingOffset=0&hiscore=false)` request, this function returns player information for
  the provided username from MongoDB, or attempts to scrape it if not found in MongoDB.

  The `scrapingOffset` will be added to the `player.scrapingOffsets` if it's not present yet, and will be used filter
  `hiscoreEntries` when `hiscore=true`.

  By default, the returned player does not include `hiscoreEntries`. However, if the query parameter `hiscore=true` is
  included in the request, the function will also include the player's most recent hiscore entry matching the
  `scrapingOffset`.

  The function automatically refreshes the player info when information from MongoDB is older than 2 hours.
