# osrs-tracker_alarm-to-discord

Runs on every message on the SNS topic `osrs-tracker-alerts`, where each Lambda's CloudWatch alarm
`osrs-tracker_<function>-errors` notifies. Posts an alarm going into `ALARM` to Discord as a red alert and one back to
`OK` as a green "Recovered" one, linking to the alarmed function's log group and monitoring tab; other state changes are
logged and skipped. Throws when a message isn't an alarm or Discord can't be reached, so Lambda retries the invocation.
The topic's email subscription stays as the backstop: it gets every alarm, also this Lambda's own.

Environment (validated at cold start by `src/env.ts` with `lambda/shared/src/env.ts`, which names any missing or invalid
variable): `WEBHOOK_URL`. Optional: `DRY_RUN`. No MongoDB variables: it has no database.

Run it locally without posting anything: copy `.env.example` to `.env`, fill it in, then `npm run invoke:dry` (an alarm)
or `npm run invoke:dry -- OK` (a recovery). See the [root README](../../README.md) for how it fits with the other jobs.
