# Changelog

Changes to the Lambdas, AWS infrastructure and CI. Package changes are logged in each `@osrs-tracker/*` package's own
`CHANGELOG.md`.

## 2026/10/02

- Updated `@osrs-tracker/discord-webhooks` to `^0.1.0` in the Lambdas, which removes the unused `discord.js` install.
- Added a safe local run for all Lambdas: `npm run invoke:dry` runs the handler once with `DRY_RUN=true`, which logs
  every write (Mongo writes and indexes, SQS sends, Discord alerts) instead of executing it, while reads and fetches
  still happen. Locally the Lambdas authenticate to Atlas with SCRAM when `MONGODB_USERNAME`/`MONGODB_PASSWORD` are set
  (see `.env.example`); production is unchanged and keeps MONGODB-AWS.
- Raised memory from 128 MB to 256 MB for `osrs-tracker_refresh-items`, `osrs-tracker_queue-players` and
  `osrs-tracker_process-players`, which peaked at 86–90% of 128 MB over the last 7 days. `osrs-tracker_clean-hiscores`
  (76%) stays at 128 MB.
- Added the missing `WEBHOOK_URL` to `osrs-tracker_queue-players`, so its error alerts reach Discord.
- Deployed the Node 24 upgrade of `osrs-tracker_refresh-items`, `osrs-tracker_clean-hiscores` and
  `osrs-tracker_queue-players` and switched their runtime to `nodejs24.x`.
- CI now runs on Node 24 with `actions/checkout@v7` and `actions/setup-node@v7`, and the npm cache is keyed per project.
- Added a CI job for the `@osrs-tracker/*` packages: it runs the `hiscores` jest tests, builds `models`, `hiscores` and
  `discord-webhooks`, and checks that the committed `dist/` matches the build.
- Synced the out-of-date `@osrs-tracker/models` lockfile (`@types/node` ^24) so `npm ci` passes.
- Upgraded all Lambdas to Node 24: `update:runtime` now targets `nodejs24.x`, `@types/node` `^24` and
  `engines.node >=24`.
- Upgraded Lambda dependencies to the same majors: `mongodb` 7, `@osrs-tracker/models` 0.7.1, `date-fns` 4,
  `@aws-sdk/client-sqs` latest, `esbuild` 0.28, `eslint` 10, `typescript` 5.9 and `prettier` 3.9. Removed the unused
  `aws4`.
- `mongodb` 7 no longer accepts explicit credentials for `MONGODB-AWS`, so the Lambdas now get them from the AWS SDK
  credential chain (`@aws-sdk/credential-providers`).
- Added a missing `.prettierignore` to `osrs-tracker_queue-players`.
- Removed stale EventBridge targets for the deleted `osrs-tracker_hiscore-parser-validator` (`Hourly`) and
  `osrs-tracker_queue-items` (`four-hourly`) functions.
- Deleted the disabled SQS event-source mapping for the deleted `osrs-tracker_process-items` function.
- Deleted the empty EventBridge rules `bihourly` and `four-hourly`.
- Deleted 8 empty CloudWatch log groups belonging to deleted `osrs-tracker_*` functions.
- Added the `osrs-tracker-aws` project skill (`.claude/skills/osrs-tracker-aws/SKILL.md`), which documents the layout,
  console-managed infra, conventions, verification, deploy and commit workflow.
- Added this root changelog for Lambda, infra and CI changes.
