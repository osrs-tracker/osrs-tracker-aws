# OSRS Tracker AWS

This repository contains the AWS code and configuration for OSRS Tracker.

## Lambda functions
- `osrs-tracker_queue-items`

Fetch all OSRS item categories, split them up into pages and push them to a SQS queue where they will wait to be processed.

- `osrs-tracker_process-items`

When a message arrives in the SQS queue, scrape the pages present in the message to get the items and upsert them to our database.
