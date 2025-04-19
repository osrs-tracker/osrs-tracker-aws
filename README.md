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

- **osrs-tracker_hiscore-parser-validator**

  This function fetches the hiscores every hour for a few test usernames and will run the `parseHiscoreString` function
  from the `@osrs-tracker/hiscores` package to test if the current parser is still valid, and no api changes have
  happened.

- **osrs-tracker_clean-hiscores**

  This function deletes all hiscores older then 60 days from the data base every day at UTC midnight.
