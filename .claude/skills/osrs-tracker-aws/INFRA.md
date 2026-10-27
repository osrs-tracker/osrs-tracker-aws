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

The `claude` profile can change only the `osrs-tracker_*` Lambdas (code, configuration, async invoke config,
concurrency, and invoking them: a live invoke does real writes, so it needs approval like any other change), the
EventBridge rules and the Lambdas' log retention. Anything else (the alarms, `set-alarm-state` included, the SNS topic,
the SQS queues, the DynamoDB table, the API Gateway proxy, IAM) is denied: give the maintainer the exact command to run
instead.

`aws lambda update-function-configuration --environment` replaces the whole env map: merge with the current values in a
temp JSON file outside the repo, never print the values, and delete the file afterwards.

Each Lambda's `npm run update:runtime` (`update-function-configuration --runtime nodejs24.x`) is such a change too: show
it and wait for approval like any other.

## API Gateway hiscore proxy

`runescape-api.freekmencke.com`: `ANY /rs/{proxy+}` → `https://secure.runescape.com/{proxy}`, CORS for the web app's
origins and `localhost:4200`, and `X-Robots-Tag: noindex` on its 200 responses. Used by the web app (browser),
osrs-tracker-api and process-players, so **check any route, header or CORS change from the web and API sides too**. No
throttling: a CloudWatch alarm on its request count stands in (see "CloudWatch alarms").

## Schedules and async invokes

- EventBridge `Hourly` triggers queue-players; `osrs-tracker_record-player-count` (`rate(10 minutes)`) triggers
  record-player-count. The SNS topic `osrs-tracker-alerts` triggers alarm-to-discord (see "CloudWatch alarms").
- Each function's limits and async retries (all arm64, nodejs24.x). Retries are turned off with
  `put-function-event-invoke-config --maximum-retry-attempts 0`; without that config Lambda retries twice.

  | Function            | Timeout | Memory | Async retries                                                                                                                                                 |
  | ------------------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | alarm-to-discord    | 10 s    | 256 MB | default (2): it throws when a message isn't an alarm or Discord can't be reached; a duplicate alert beats a lost one                                          |
  | process-players     | 60 s    | 256 MB | 2, max event age 1 h, on failure to `osrs-tracker_players-to-scrape-dead`: it throws only when there's nothing to send or the send fails. Never 0 (see below) |
  | queue-players       | 30 s    | 256 MB | 0: a retry after its first invoke would queue the hour's players again (a second snapshot that day)                                                           |
  | record-player-count | 30 s    | 256 MB | 0: a missed sample stays missed, and a retry would send the same alert again                                                                                  |

- queue-players invokes process-players asynchronously (`InvocationType: 'Event'`), one event
  `{ usernames, scrapingOffset }` per `PLAYERS_PER_EVENT` players. Lambda's own event queue holds the events: nothing
  polls, and an SQS trigger's empty receives are gone (#161).
- process-players has **reserved concurrency 5**, to spare the hiscore proxy and Jagex's hiscores bursts; don't drop it.
  Events past 5 at once are throttled and wait in Lambda's queue, retried with backoff (1 s up to 5 min apart) until the
  max event age, not failed. So the 00:00 UTC run (offset 0, about 54 events) takes roughly 10 to 20 minutes to drain,
  against 3.5 with SQS. That's expected, not a fault.
- Its async retries handle its two throws, when every scrape in an event failed (usually a hiscores or proxy outage) or
  the results queue didn't take its message: Lambda retries the event 1 and then 2 minutes later. Retries at 0 would
  drop those events at once.
- Players whose fetch failed in a run that sent others are requeued: process-players invokes itself with them and
  `retry` counted up, at most 3 times (`MAX_RETRIES`); after that it alerts `Gave up retrying` instead. Lambda's
  recursive loop detection would stop a chain at about 16 invocations; this one has at most 5.
- Async invokes are at-least-once: rarely, an event runs twice, and the ingester's slot guard skips the second entry.
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
  `SCRAPE_RESULTS_QUEUE_URL`; since #166 their only output: neither writes MongoDB) to the ingester on fremen-server
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

- Each Lambda has its own execution role, `osrs-tracker_<function>-role` (#168 split the shared `AWS_Lambda`), with the
  managed `AWSLambdaBasicExecutionRole` for its logs and one inline policy, `osrs-tracker_<function>`, for the rest:
  - queue-players: Scan on the table, invoke process-players;
  - process-players: SendMessage on the results queue and on its on-failure destination
    `osrs-tracker_players-to-scrape-dead`, invoke itself (its retry events);
  - record-player-count: SendMessage on the results queue;
  - alarm-to-discord: logs only (no inline policy).

  A new AWS call in a Lambda needs its permission added to that Lambda's inline policy, by the maintainer.

- The `claude` profile can't read IAM, so `infra/aws-settings.json` shows each Lambda's role name but neither the
  ingester's user nor the roles' policies.

## When an alert fires

An alert's title links to the invocation's log stream and its author to the Lambda's monitoring tab: read that stream
first (logs are kept 7 days).

| Alert                                           | Means                                                                                                                                                                                                   | Do                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| queue-players `No subscriptions`                | `osrs-tracker_subscriptions` is empty, so nothing was queued this hour. The sync never empties it (its delete guard): someone emptied or replaced it.                                                   | Read the ingester's `Subscriptions` logs on the cluster; its next sync (every 15 minutes) refills the table from MongoDB. |
| queue-players `Failed to queue players`         | Lambda refused async invokes of process-players: those players miss this hour's scrape.                                                                                                                 | Read the logged errors (throttling, permissions); they're scraped again the next day.                                     |
| process-players `No players were updated`       | Every fetch in a requeued event failed (usually a hiscores or proxy outage). Lambda retries, then the dead queue.                                                                                       | Check the proxy and Jagex's hiscores; then handle the dead queue as above.                                                |
| process-players `Gave up retrying`              | These players' fetches failed in 4 runs in a row (requeued 3 times): they miss today.                                                                                                                   | Check the proxy and Jagex's hiscores for them. Nothing unless it repeats.                                                 |
| process-players `Failed to queue retries`       | Lambda refused the retry events for failed players: they miss today.                                                                                                                                    | Read the logged errors.                                                                                                   |
| record-player-count `Player count not recorded` | Jagex's world list failed, didn't parse (a format change) or had no worlds or players, or the results queue didn't take the sample: no sample for those 10 minutes. Repeats every run until it's fixed. | Read the error in the alert. A format change needs `parseWorldList` updated against a fresh response.                     |

The ingester's own alerts, such as `Paused scraping` (since #166) and `No hiscores scraped` (clean-hiscores' until
#167), come from osrs-tracker-api.

### CloudWatch alarms

Each function has an alarm `osrs-tracker_<function>-errors` on its `AWS/Lambda` `Errors` (sum ≥ 1, missing data not
breaching) that notifies the SNS topic `osrs-tracker-alerts` on going into `ALARM` and back to `OK`. It catches what the
Discord alerts can't: an error before a handler runs (the env check at cold start), and a timeout or out-of-memory. The
period matches the function's schedule (record-player-count 10 minutes, the others an hour), so the alarm stays in
`ALARM` until a period passes without errors and notifies once per failure, also when Lambda retries a failing
process-players event.

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
with `aws cloudwatch set-alarm-state --alarm-name <alarm> --state-value ALARM --state-reason test` (the maintainer runs
it; the `claude` profile can't): a red Discord alert arrives, and on its next evaluation the alarm returns to `OK` with
a green one. A real alarm returns to `OK` after a full period without errors: for the scheduled functions, when their
next run passes.
