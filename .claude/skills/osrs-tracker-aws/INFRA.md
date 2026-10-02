# Infra (console-managed, no IaC)

Everything lives in `eu-central-1` and was created in the console, so this repo has no diff to review. The account also
holds unrelated resources: leave anything not prefixed `osrs-tracker` alone. Look up IDs with read-only calls rather
than hard-coding them (e.g. `aws apigatewayv2 get-apis`, `aws sqs list-queues`, `aws events list-rules`).

## Changing anything

1. Record the before state, e.g. `aws lambda get-function-configuration --function-name <fn>` or
   `aws apigatewayv2 get-integration --api-id <id> --integration-id <id>`, and keep it in your reply for rollback.
2. Show the user the **exact** CLI command and wait for their approval.
3. Re-read the resource to confirm, and log the change in the root `CHANGELOG.md`.

`aws lambda update-function-configuration --environment` replaces the whole env map: merge with the current values via a
temp JSON file outside the repo, never print the values, and delete the file afterwards.

## API Gateway hiscore proxy

HTTP API with custom domain `runescape-api.freekmencke.com`: route `ANY /rs/{proxy+}` is an HTTP_PROXY to
`https://secure.runescape.com/{proxy}`, with CORS for the web app's origin and `localhost:4200`. Its three consumers,
all GET-only: the web app (browser), osrs-tracker-api (server-side, news RSS and hiscores) and process-players. **Any
change to the route, headers or CORS affects all three**, so get a check from the web and API sides too.

## Schedules and queue

- EventBridge `Hourly` triggers queue-players and refresh-items; `daily` (00:00 UTC) triggers clean-hiscores.
- queue-players sends usernames to SQS `osrs-tracker_players-to-scrape`, consumed by process-players (batch 1, max
  concurrency 5); redrive to `osrs-tracker_players-to-scrape-dead` after 3 receives.
- **Keep the queue's visibility timeout above process-players' function timeout** (currently 2×), or a message reappears
  while it is still being processed. A batch takes roughly 20 s (2 s stagger per player, 10 s fetch timeout).
- 404 players are skipped rather than retried, so DLQ messages point to real failures (5xx, network, timeouts). Peek
  with a non-zero visibility timeout; every receive raises the receive count.

## MongoDB Atlas auth

The cluster host is in the Lambdas' `MONGODB_URI` (and local `.env`).

- Lambdas use `MONGODB-AWS`: mongodb 7 takes the role's credentials from the AWS SDK chain
  (`@aws-sdk/credential-providers`, bundled) and **rejects an explicit username/password** for this mechanism.
- Locally, and in the API, auth is SCRAM with an Atlas database user. So rotating the Lambda role's credentials doesn't
  affect the API, and vice versa.
