[![GitHub issues](https://img.shields.io/github/issues/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/issues)
[![GitHub license](https://img.shields.io/github/license/osrs-tracker/osrs-tracker-aws.svg)](https://github.com/osrs-tracker/osrs-tracker-aws/blob/master/LICENSE)

# OSRS Tracker AWS

This repository contains the AWS code and configuration for OSRS Tracker, an application designed to track item prices
and player information in the game Old School RuneScape.

## Lambda functions

### Schedule Driven

- `osrs-tracker_queue-items`

  This function fetches all OSRS item categories, splits them up into pages, and pushes them to a SQS queue where they
will wait to be processed.

- `osrs-tracker_process-items`

  This function fetches all OSRS items for the provided item pages, and upserts them in MongoDB.

- `osrs-tracker_queue-players`

  This function fetches all players that have opted in for tracking at a particular UTC offset, and pushes them to a SQS
queue where they will wait to be processed.

  Calculates current offset from the `ScheduledEvent` and queries MongoDB for players that have opted in for tracking at
that specific offset.

- `osrs-tracker_process-players`

  This function fetches OSRS hiscores for the provided usernames, and prepends the hiscore to the `player.hiscoreEntries`
array.

### API Gateway driven

- `osrs-tracker_item-info`

  When sending a `GET /:id` request, this function returns item details from MongoDB.

- `osrs-tracker_item-search`

  When sending a `GET /:query` request, this function returns items from MongoDB where the name partially matches the
provided query. It also adds a confidence score property.

- `osrs-tracker_player-info`

  When sending a `GET /:username` request, this function returns player information for the provided username in MongoDB.
It includes player type, status, and diedAsHardcore. The function automatically refreshes when information from MongoDB
is older than 2 hours.
