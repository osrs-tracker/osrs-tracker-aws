# OSRS Tracker AWS

This repository contains the AWS code and configuration for OSRS Tracker, an application designed to track item prices
and player information in the game Old School RuneScape.

## Lambda functions

### Schedule Driven

- `osrs-tracker_queue-items`

This function fetches all OSRS item categories, splits them up into pages, and pushes them to a SQS queue where they
will wait to be processed.

- `osrs-tracker_process-items`

This function fetches all OSRS item categories, splits them up into pages, and pushes them to a SQS queue where they
will wait to be processed.

### API Gateway driven

- `osrs-tracker_item-info`

When sending a `GET /:id` request, this function returns item details from MongoDB.

- `osrs-tracker_item-search`

When sending a `GET /:query` request, this function returns items from MongoDB where the name partially matches the
provided query. It also adds a confidence score property.

- `osrs-tracker_player-info`

When sending a `GET /:username` request, this function returns player information for the provided username in MongoDB.
It includes player type, status, and diedAsHardcore. The function automatically refreshes when information from
MongoDB is older than 2 hours.
