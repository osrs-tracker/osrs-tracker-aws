# Infra (console-managed, no IaC)

Everything is in `eu-central-1`. Every `aws` call uses `--profile claude`. Leave anything not prefixed `osrs-tracker`
alone. Look up IDs with read-only calls (`aws apigatewayv2 get-apis`, `aws sqs list-queues`, `aws events list-rules`).

`infra/aws-settings.json` is the live configuration as `infra/snapshot.sh` last read it (read-only calls; names and
settings, no IDs or env values). This file says why the values are what they are; the JSON shows what's live. After
running the script, `git diff infra/` shows drift from the console.

## Changing anything

1. Record the before state (e.g. `aws lambda get-function-configuration`) and keep it in your reply for rollback.
2. Show the user the **exact** command and wait for approval.
3. Re-read the resource to confirm, run `infra/snapshot.sh`, and commit `infra/aws-settings.json` with a changelog entry
   (and this file, if a value it lists changed).

`aws lambda update-function-configuration --environment` replaces the whole env map: merge with the current values in a
temp JSON file outside the repo, never print the values, and delete the file afterwards.

Each Lambda's `npm run update:runtime` (`update-function-configuration --runtime nodejs24.x`) is such a change too: show
it and wait for approval like any other.

## API Gateway hiscore proxy

`runescape-api.freekmencke.com`: `ANY /rs/{proxy+}` → `https://secure.runescape.com/{proxy}`, CORS for the web app's
origin and `localhost:4200`, and `X-Robots-Tag: noindex` on its 200 responses. Used by the web app (browser),
osrs-tracker-api and process-players, so **check any route, header or CORS change from the web and API sides too**. No
throttling: a CloudWatch alarm on its request count stands in (see "CloudWatch alarms").

## Schedules and async invokes

- EventBridge `Hourly` triggers queue-players and refresh-items; `daily` (00:00 UTC) triggers clean-hiscores;
  `osrs-tracker_record-player-count` (`rate(10 minutes)`) triggers record-player-count. The SNS topic
  `osrs-tracker-alerts` triggers alarm-to-discord (see "CloudWatch alarms").
- Each function's limits and async retries (all arm64, nodejs24.x). Retries are turned off with
  `put-function-event-invoke-config --maximum-retry-attempts 0`; without that config Lambda retries twice.

  | Function            | Timeout | Memory | Async retries                                                                                                                           |
  | ------------------- | ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
  | alarm-to-discord    | 10 s    | 256 MB | default (2): it throws when a message isn't an alarm or Discord can't be reached; a duplicate alert beats a lost one                    |
  | clean-hiscores      | 60 s    | 256 MB | 0: a retry would send the "No hiscores scraped" alert again, and the next night's run catches up a missed clean-up                      |
  | process-players     | 60 s    | 256 MB | 2, max event age 1 h, on failure to `osrs-tracker_players-to-scrape-dead`: it throws only when nothing was written. Never 0 (see below) |
  | queue-players       | 30 s    | 256 MB | 0: a retry after its first invoke would queue the hour's players again (a second snapshot that day)                                     |
  | record-player-count | 30 s    | 256 MB | 0: a missed sample stays missed, and a retry would send the same alert again                                                            |
  | refresh-items       | 30 s    | 256 MB | default (2): its upserts are idempotent                                                                                                 |

- queue-players invokes process-players asynchronously (`InvocationType: 'Event'`), one event
  `{ usernames, scrapingOffset }` per `PLAYERS_PER_EVENT` players. Lambda's own event queue holds the events: nothing
  polls, and an SQS trigger's empty receives are gone (#161).
- process-players has **reserved concurrency 5**, to spare the hiscore proxy and Jagex's hiscores bursts; don't drop it.
  Events past 5 at once are throttled and wait in Lambda's queue, retried with backoff (1 s up to 5 min apart) until the
  max event age, not failed. So the 00:00 UTC run (offset 0, about 54 events) takes roughly 10 to 20 minutes to drain,
  against 3.5 with SQS. That's expected, not a fault.
- Its async retries handle the one throw, when every scrape in an event failed (usually a hiscores or proxy outage):
  Lambda retries the event 1 and then 2 minutes later. Retries at 0 would drop those events at once.
- Players whose fetch failed in a run that wrote others are requeued: process-players invokes itself with them and
  `retry` counted up, at most 3 times (`MAX_RETRIES`); after that it alerts `Gave up retrying` instead. Lambda's
  recursive loop detection would stop a chain at about 16 invocations; this one has at most 5.
- Async invokes are at-least-once: rarely, an event runs twice and stores a duplicate hiscore entry, as SQS redelivery
  could.
- An event whose attempts all failed, or that waited past the max event age, goes to the on-failure destination,
  `osrs-tracker_players-to-scrape-dead` (SQS, kept 7 days), as an invocation record: the event is under
  `requestPayload`, next to `requestContext` (`condition`: `RetriesExhausted` or `EventAgeExceeded`;
  `approximateInvokeCount`) and `responsePayload` (the error). Nothing polls it; the alarm
  `osrs-tracker_process-players-failed-events` (see "CloudWatch alarms") fires while it holds any.
- Peek with a non-zero visibility timeout and unwrap each record:
  `aws sqs receive-message --queue-url <dead queue URL> --max-number-of-messages 10 --visibility-timeout 60` and
  `jq '.Messages[].Body | fromjson | .requestPayload'`. Once the cause is fixed (or was a Jagex outage), replay each
  `requestPayload`, after approval:
  `aws lambda invoke --function-name osrs-tracker_process-players --invocation-type Event --cli-binary-format raw-in-base64-out --payload '<requestPayload>' /dev/null`,
  then delete that message (`aws sqs delete-message`); if they're stale, `aws sqs purge-queue` instead. Not
  `start-message-move-task`: there is no source queue to move them back to, and the function would get the whole record.
  Replayed events are scraped with the current date, so a day that was missed stays missed. The `claude` profile can
  invoke but not delete or purge: the maintainer does that part.

## Scrape results and subscriptions

Set up for roadmap #162 (MongoDB moves to fremen-server) in #163. queue-players reads the table since #164.

- `osrs-tracker_scrape-results.fifo` carries the scrape results from process-players and record-player-count (#165,
  `SCRAPE_RESULTS_QUEUE_URL`; both still write MongoDB too until #166) to the ingester on fremen-server
  (osrs-tracker/osrs-tracker-api#203), which long-polls it once a minute and applies them to MongoDB.
  - **Never a standard queue**: FIFO keeps the results in order per message group (one per offset, plus `playerCount`).
  - **Content-based deduplication only.** An explicit deduplication ID such as `slot:offset` would be shared by the ~54
    offset-0 messages at 00:00 UTC, and SQS would drop all but one.
  - Retention 14 days (the maximum): the cluster can be down that long before results are lost.
  - Visibility timeout 60 s: the ingester restarts on every API deploy, and a message it held blocks its group until the
    timeout.
  - SSE-SQS, so no `kms:Decrypt` is needed.
- `osrs-tracker_scrape-results-dead.fifo` takes a result after 10 receives and keeps it 14 days.
- `osrs-tracker_subscriptions` (DynamoDB) is who to scrape: one item per player, `{ username, scrapingOffsets }`
  (`scrapingOffsets` is a Number Set). It's a copy of MongoDB that queue-players reads (#164), so scraping goes on while
  the cluster is down; the ingester rewrites it every 15 minutes (osrs-tracker/osrs-tracker-api#204).
  - Provisioned 5 RCU and 5 WCU, inside the always-free 25 and 25 (no other tables in the account).
  - Deletion protection on.
  - No point-in-time recovery: it's a derived copy.
- IAM user `osrs-tracker_ingester`, for the ingester, which runs outside AWS. Its one inline policy
  (`osrs-tracker_ingester`) grants:
  - on the results queue: receive, delete, change visibility and get attributes;
  - on the table: Scan, PutItem and DeleteItem;
  - all of it only from fremen-server's static IPv4 (`aws:SourceIp`). The IP is in the fremen-cluster README and never
    in this repo. A new server IP needs this condition updated, or every call is denied, which only the 2-day age alarm
    shows.

  Its one access key is in the cluster's `osrs-tracker-ingester` Secret (FreekMencke/fremen-cluster#17).

- The Lambdas' shared role `AWS_Lambda` has two inline policies from this work (#168 splits the role):
  - `osrs-tracker_process-players-async`: invoke process-players, and send to its on-failure destination (#161);
  - `osrs-tracker_results-and-subscriptions`: SendMessage on the results queue (#165) and Scan on the table (#164).
- The `claude` profile can't read IAM, so `infra/aws-settings.json` shows neither the user nor the role's policies.

## When an alert fires

An alert's title links to the invocation's log stream and its author to the Lambda's monitoring tab: read that stream
first (logs are kept 7 days).

| Alert                                                 | Means                                                                                                                                                                           | Do                                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| clean-hiscores `No hiscores scraped`                  | No player has an entry from the last 2 days: scraping stopped (EventBridge `Hourly`, queue-players or process-players).                                                         | Check the latest queue-players and process-players runs and the dead queue.                                                                          |
| queue-players `No subscriptions`                      | `osrs-tracker_subscriptions` is empty, so nothing was queued this hour. The sync never empties it (its delete guard): someone emptied or replaced it.                           | Read the ingester's `Subscriptions` logs on the cluster; its next sync (every 15 minutes) refills the table from MongoDB.                            |
| queue-players `Failed to queue players`               | Lambda refused async invokes of process-players: those players miss this hour's scrape.                                                                                         | Read the logged errors (throttling, permissions); they're scraped again the next day.                                                                |
| process-players `No players were updated`             | Every fetch in a requeued event failed (usually a hiscores or proxy outage), or its hiscore layout couldn't be stored (Atlas unreachable). Lambda retries, then the dead queue. | Check the proxy and Jagex's hiscores; then handle the dead queue as above.                                                                           |
| process-players `Gave up retrying`                    | These players' fetches failed in 4 runs in a row (requeued 3 times): they miss today.                                                                                           | Check the proxy and Jagex's hiscores for them. Nothing unless it repeats.                                                                            |
| process-players `Failed to store hiscores`            | A bulk write failed after the fetches: those players have no entry for today.                                                                                                   | Check Atlas (limits, connectivity) in the logs. Don't requeue by hand on a day they already have an entry.                                           |
| process-players `Failed to send scrape results`       | The results queue didn't take the run's `hiscores` message (logged with its error). Their entries are in MongoDB while process-players still writes them (until #166).          | Read the logged error (permissions on `AWS_Lambda`, the queue URL). Nothing to replay before #166.                                                   |
| process-players `Failed to queue retries`             | Lambda refused the retry events for failed players: they miss today.                                                                                                            | Read the logged errors.                                                                                                                              |
| process-players `Paused scraping`                     | Players off the hiscores for 7 days were paused (expected for renames and bans).                                                                                                | Nothing; a lookup in the API resumes them ([DATA-MODEL.md](../../../DATA-MODEL.md)).                                                                 |
| record-player-count `Player count not recorded`       | Jagex's world list failed, didn't parse (a format change) or had no worlds or players: no sample for those 10 minutes. Repeats every run until it's fixed.                      | Read the error in the alert. A format change needs `parseWorldList` updated against a fresh response.                                                |
| record-player-count `Player count not sent`           | The results queue didn't take the sample's `playerCount` message. The sample is stored in MongoDB (until #166).                                                                 | Read the logged error (permissions, the queue URL). Nothing to replay before #166.                                                                   |
| record-player-count `Daily player counts not updated` | The sample was stored, but recomputing the daily averages (`playerCountsDaily`) failed. The next run recomputes every day it missed. Repeats every run while it lasts.          | Nothing for a one-off. When it repeats, read the error: Atlas connectivity or limits, or the Lambda's database user can't write `playerCountsDaily`. |

### CloudWatch alarms

Each function has an alarm `osrs-tracker_<function>-errors` on its `AWS/Lambda` `Errors` (sum ≥ 1, missing data not
breaching) that notifies the SNS topic `osrs-tracker-alerts` on going into `ALARM` and back to `OK`. It catches what the
Discord alerts can't: any refresh-items failure (it has no Discord alert), an error before a handler runs (the env check
at cold start), and a timeout or out-of-memory. The period matches the function's schedule (record-player-count 10
minutes, clean-hiscores a day, the others an hour), so the alarm stays in `ALARM` until a period passes without errors
and notifies once per failure, also when Lambda retries a failing process-players event.

`osrs-tracker_process-players-failed-events` watches process-players' on-failure destination: the `AWS/SQS`
`ApproximateNumberOfMessagesVisible` of `osrs-tracker_players-to-scrape-dead`, 1 or more (maximum over 5 minutes,
missing data not breaching), also on the topic, going into `ALARM` and back to `OK`. It stays in `ALARM` until the queue
is emptied (see "Schedules and async invokes"), so one alert per batch of failed events.

The scrape results have three alarms, also on the topic, going into `ALARM` and back to `OK`, with missing data not
breaching. They're on AWS so they fire while the cluster, and its own alerting, is down:

- `osrs-tracker_scrape-results-age-2d`: the results queue's `ApproximateAgeOfOldestMessage` (maximum over an hour) above
  2 days.
- `osrs-tracker_scrape-results-age-10d`: the same above 10 days, 4 days before results expire.
- `osrs-tracker_scrape-results-dead-messages`: the results dead-letter queue's `ApproximateNumberOfMessagesVisible`, 1
  or more (maximum over 5 minutes).

For an age alarm, check the cluster, the ingester's pod and logs, and whether the server's IP changed (the IAM user's
`aws:SourceIp`, see "Scrape results and subscriptions"). For the dead-letter alarm, read the ingester's logs: it can't
apply those results.

`osrs-tracker_hiscore-proxy-requests` watches the hiscore proxy instead (#138): its `AWS/ApiGateway` `Count` on the
`$default` stage, 1,500 or more in 5 minutes (sum, missing data not breaching), also on the topic, going into `ALARM`
and back to `OK`. Its busiest 5 minutes are about 500, every night around 00:00 UTC, and process-players alone can't
pass about 750 (5 at a time, 2 s apart). The proxy has no limit of its own on purpose: a limit is shared by every
caller, so a flood would get process-players' requests refused too. This alarm means someone may be using the proxy as a
relay. Check the API's `Count`; if it's abuse, follow #138's plan (a secret route for process-players and
osrs-tracker-api, then a limit on `/rs` only).

The topic has two subscriptions:

- alarm-to-discord posts `ALARM` as a red Discord alert (`Alarm: <alarm>`: the alarm's description, then AWS's reason)
  and `ALARM` → `OK` as a green one (`Recovered: <alarm>`: `Back to normal: no threshold crossed for 1 hour.`, from the
  alarm's period). Keep each alarm's description saying what it means and what to do, without the function's name (the
  alert's author shows it): it is the alert's text. A Lambda's alarm links to that function's log group and monitoring
  tab (from its `FunctionName` dimension), any other alarm to the alarm itself in the CloudWatch console. It skips other
  changes, such as a new alarm's first `OK`.
- The maintainer's email, filtered to alarm-to-discord's own alarm (filter policy on `AlarmName`, scope `MessageBody`):
  every other alarm arrives once, in Discord, and a broken alarm-to-discord still reaches someone. A Discord error
  response (a revoked webhook, rate limiting) is only logged, so it raises no alarm.

An error alarm means: read that function's latest log stream (a Discord alert for the same run may say more). Test one
with `aws cloudwatch set-alarm-state --alarm-name <alarm> --state-value ALARM --state-reason test`: a red Discord alert
arrives, and on its next evaluation the alarm returns to `OK` with a green one. A real alarm returns to `OK` after a
full period without errors: for the scheduled functions, when their next run passes.
