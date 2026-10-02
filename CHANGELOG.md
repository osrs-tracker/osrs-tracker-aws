# Changelog

Changes to the Lambdas, AWS infrastructure and CI. Package changes are logged in each `@osrs-tracker/*` package's own
`CHANGELOG.md`.

## 2026/10/02

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
