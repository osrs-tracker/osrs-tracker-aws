# Infra (console-managed, no IaC)

Everything is in `eu-central-1`. Every `aws` call uses `--profile claude`. Leave anything not prefixed `osrs-tracker`
alone. Look up IDs with read-only calls (`aws apigatewayv2 get-apis`, `aws sqs list-queues`, `aws events list-rules`).

## Changing anything

1. Record the before state (e.g. `aws lambda get-function-configuration`) and keep it in your reply for rollback.
2. Show the user the **exact** command and wait for approval.
3. Re-read the resource to confirm, and add a changelog entry.

`aws lambda update-function-configuration --environment` replaces the whole env map: merge with the current values in a
temp JSON file outside the repo, never print the values, and delete the file afterwards.

Each Lambda's `npm run update:runtime` (`update-function-configuration --runtime nodejs24.x`) is such a change too: show
it and wait for approval like any other.

## API Gateway hiscore proxy

`runescape-api.freekmencke.com`: `ANY /rs/{proxy+}` → `https://secure.runescape.com/{proxy}`, CORS for the web app's
origin and `localhost:4200`. Used by the web app (browser), osrs-tracker-api and process-players, so **check any route,
header or CORS change from the web and API sides too**.

## Schedules and queue

- EventBridge `Hourly` triggers queue-players and refresh-items; `daily` (00:00 UTC) triggers clean-hiscores.
- queue-players feeds SQS `osrs-tracker_players-to-scrape` → process-players (batch 1, max concurrency 5); redrive to
  `osrs-tracker_players-to-scrape-dead` after 3 receives.
- **Keep the queue's visibility timeout above process-players' timeout** (currently 2×), or messages reappear mid-run.
- DLQ messages are real failures (5xx, network, timeouts, or a hiscore layout that couldn't be stored); 404s aren't
  retried. Peek with a non-zero visibility timeout; every receive raises the receive count. The main queue keeps
  messages 1 day, the DLQ 7 days, so act within the week.
- Once the cause is fixed (or was a Jagex outage), move them back with
  `aws sqs start-message-move-task --source-arn <DLQ ARN>` (it returns them to the main queue) after approval; if
  they're stale, `aws sqs purge-queue` on the DLQ instead. Moved messages are scraped with the current date, so a day
  that was missed stays missed.

## When an alert fires

An alert's title links to the invocation's log stream and its author to the Lambda's monitoring tab: read that stream
first (logs are kept 7 days).

| Alert                                            | Means                                                                                                                                                              | Do                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| clean-hiscores `Error cleaning hiscores`         | No entry was old enough to pull: no scrape ran `MAX_AGE_IN_DAYS` days ago, or the job already ran today.                                                           | Check the scrapes around that date in the logs (gone after 7 days) or the stored entries; nothing to fix if a scrape outage explains it. |
| queue-players `Failed to queue players`          | SQS rejected messages: those players miss this hour's scrape.                                                                                                      | Read the logged errors (throttling, permissions, size); they're scraped again the next day.                                              |
| process-players `No players were updated`        | Every fetch in a retried message failed (usually a hiscores or proxy outage), or its hiscore layout couldn't be stored (Atlas unreachable). SQS retries, then DLQ. | Check the proxy and Jagex's hiscores; then handle the DLQ as above.                                                                      |
| process-players `Failed to process some players` | Some fetches failed on a retried message; they were queued again.                                                                                                  | Nothing unless it repeats; then as above.                                                                                                |
| process-players `Failed to store hiscores`       | A bulk write failed after the fetches: those players have no entry for today.                                                                                      | Check Atlas (limits, connectivity) in the logs. Don't requeue by hand on a day they already have an entry.                               |
| process-players `Failed to queue retries`        | SQS rejected the retry messages for failed players: they miss today.                                                                                               | Read the logged errors.                                                                                                                  |
| process-players `Paused scraping`                | Players off the hiscores for 7 days were paused (expected for renames and bans).                                                                                   | Nothing; a lookup in the API resumes them ([DATA-MODEL.md](../../../DATA-MODEL.md)).                                                     |

refresh-items has no alert: a failed run only shows as a Lambda error in its logs.
