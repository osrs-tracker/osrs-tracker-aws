# Infra (console-managed, no IaC)

Everything is in `eu-central-1`. Leave anything not prefixed `osrs-tracker` alone. Look up IDs with read-only calls
(`aws apigatewayv2 get-apis`, `aws sqs list-queues`, `aws events list-rules`).

## Changing anything

1. Record the before state (e.g. `aws lambda get-function-configuration`) and keep it in your reply for rollback.
2. Show the user the **exact** command and wait for approval.
3. Re-read the resource to confirm, and add a changelog entry.

`aws lambda update-function-configuration --environment` replaces the whole env map: merge with the current values in a
temp JSON file outside the repo, never print the values, and delete the file afterwards.

## API Gateway hiscore proxy

`runescape-api.freekmencke.com`: `ANY /rs/{proxy+}` → `https://secure.runescape.com/{proxy}`, CORS for the web app's
origin and `localhost:4200`. Used by the web app (browser), osrs-tracker-api and process-players, so **check any route,
header or CORS change from the web and API sides too**.

## Schedules and queue

- EventBridge `Hourly` triggers queue-players and refresh-items; `daily` (00:00 UTC) triggers clean-hiscores.
- queue-players feeds SQS `osrs-tracker_players-to-scrape` → process-players (batch 1, max concurrency 5); redrive to
  `osrs-tracker_players-to-scrape-dead` after 3 receives.
- **Keep the queue's visibility timeout above process-players' timeout** (currently 2×), or messages reappear mid-run.
- DLQ messages are real failures (5xx, network, timeouts); 404s aren't retried. Peek with a non-zero visibility timeout;
  every receive raises the receive count.
