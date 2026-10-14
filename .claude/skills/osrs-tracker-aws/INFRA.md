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

- EventBridge `Hourly` triggers queue-players and refresh-items; `daily` (00:00 UTC) triggers clean-hiscores;
  `osrs-tracker_record-player-count` (`rate(10 minutes)`) triggers record-player-count.
- Each function's limits and async retries (all arm64, nodejs24.x). Retries are turned off with
  `put-function-event-invoke-config --maximum-retry-attempts 0`; without that config Lambda retries twice.

  | Function            | Timeout | Memory | Async retries                                                                                                      |
  | ------------------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
  | clean-hiscores      | 60 s    | 256 MB | 0: a retry would send the "No hiscores scraped" alert again, and the next night's run catches up a missed clean-up |
  | process-players     | 60 s    | 256 MB | n/a: SQS redelivers the message                                                                                    |
  | queue-players       | 30 s    | 256 MB | 0: a retry after its first SQS send would queue the hour's players again (a second snapshot that day)              |
  | record-player-count | 30 s    | 256 MB | 0: a missed sample stays missed, and a retry would send the same alert again                                       |
  | refresh-items       | 30 s    | 256 MB | default (2): its upserts are idempotent                                                                            |

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

| Alert                                                 | Means                                                                                                                                                                  | Do                                                                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| clean-hiscores `No hiscores scraped`                  | No player has an entry from the last 2 days: scraping stopped (EventBridge `Hourly`, queue-players or process-players).                                                | Check the latest queue-players and process-players runs, the queue and the DLQ.                                                                      |
| queue-players `Failed to queue players`               | SQS rejected messages: those players miss this hour's scrape.                                                                                                          | Read the logged errors (throttling, permissions, size); they're scraped again the next day.                                                          |
| process-players `No players were updated`             | Every fetch in a retried message failed (usually a hiscores or proxy outage), or its hiscore layout couldn't be stored (Atlas unreachable). SQS retries, then DLQ.     | Check the proxy and Jagex's hiscores; then handle the DLQ as above.                                                                                  |
| process-players `Failed to process some players`      | Some fetches failed on a retried message; they were queued again.                                                                                                      | Nothing unless it repeats; then as above.                                                                                                            |
| process-players `Failed to store hiscores`            | A bulk write failed after the fetches: those players have no entry for today.                                                                                          | Check Atlas (limits, connectivity) in the logs. Don't requeue by hand on a day they already have an entry.                                           |
| process-players `Failed to queue retries`             | SQS rejected the retry messages for failed players: they miss today.                                                                                                   | Read the logged errors.                                                                                                                              |
| process-players `Paused scraping`                     | Players off the hiscores for 7 days were paused (expected for renames and bans).                                                                                       | Nothing; a lookup in the API resumes them ([DATA-MODEL.md](../../../DATA-MODEL.md)).                                                                 |
| record-player-count `Player count not recorded`       | Jagex's world list failed, didn't parse (a format change) or had no worlds or players: no sample for those 10 minutes. Repeats every run until it's fixed.             | Read the error in the alert. A format change needs `parseWorldList` updated against a fresh response.                                                |
| record-player-count `Daily player counts not updated` | The sample was stored, but recomputing the daily averages (`playerCountsDaily`) failed. The next run recomputes every day it missed. Repeats every run while it lasts. | Nothing for a one-off. When it repeats, read the error: Atlas connectivity or limits, or the Lambda's database user can't write `playerCountsDaily`. |

### CloudWatch alarms

Each function has an alarm `osrs-tracker_<function>-errors` on its `AWS/Lambda` `Errors` (sum ≥ 1, missing data not
breaching) that emails the maintainer through the SNS topic `osrs-tracker-alerts`. It catches what the Discord alerts
can't: any refresh-items failure (it has no Discord alert), an error before a handler runs (the env check at cold
start), and a timeout or out-of-memory. The period matches the function's schedule (record-player-count 10 minutes,
clean-hiscores a day, the others an hour), so the alarm stays in `ALARM` until a period passes without errors and sends
one email per failure, also when SQS redelivers a failing process-players message.

An alarm email means: read that function's latest log stream (a Discord alert for the same run may say more). Alarms
aren't sent to Discord (that needs a forwarding Lambda or AWS Chatbot, parked in #116). Test one with
`aws cloudwatch set-alarm-state --alarm-name <alarm> --state-value ALARM --state-reason test`; it returns to `OK` on its
next evaluation.
