# osrs-tracker_alarm-to-discord

Runs on every message on the SNS topic `osrs-tracker-alerts`, where the CloudWatch alarms notify (each Lambda's
`osrs-tracker_<function>-errors` and the hiscore proxy's `osrs-tracker_hiscore-proxy-requests`). Posts an alarm going
into `ALARM` to Discord as a red alert and one back to `OK` as a green "Recovered" one; other state changes are logged
and skipped. A Lambda's alarm links to that function's log group and monitoring tab, any other alarm to the alarm itself
in the CloudWatch console. Throws when a message isn't an alarm or Discord can't be reached, so Lambda retries the
invocation. The topic's email subscription is filtered to this Lambda's own alarm, so a broken forwarder still reaches
someone.

Environment (validated at cold start by `src/env.ts` with `lambda/shared/src/env.ts`, which names any missing or invalid
variable): `WEBHOOK_URL`. Optional: `DRY_RUN`. No MongoDB variables: it has no database.

Run it locally without posting anything: copy `.env.example` to `.env`, fill it in, then `npm run invoke:dry` (an alarm)
or `npm run invoke:dry -- OK` (a recovery). See the [root README](../../README.md) for how it fits with the other jobs.
