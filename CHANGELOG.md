# Changelog

Changes to the Lambdas, AWS infrastructure and CI. Package changes are logged in each `@osrs-tracker/*` package's own
`CHANGELOG.md`.

## 2026/10/03

- Ran `npm audit fix` in the repo root and all 4 Lambdas to patch vulnerable dev dependencies (eslint and commitizen
  dependencies such as `lodash`, `@humanfs/node`, `minimatch`, `js-yaml` and `tmp`). Production dependencies are
  unchanged, so no deploy is needed. The root still reports 6 high findings from `braces` through commitizen: every
  `braces` version is affected and the only fix npm offers is downgrading commitizen to 2.8.2.
- CI only checks the packages and Lambdas a PR or push changed, found from the repo's folders so new ones are picked up
  automatically. Manual runs, workflow changes and an unknown base still check everything. A single `CI` job sums up the
  result, so it's the only check branch protection needs to require.
- Project skill: ask whether to commit straight to `main` or open a PR, and how to clean up after a merge.

## 2026/10/02

- Restructured the project skill: `SKILL.md` keeps the rules, local runs, verification and commit workflow; infra,
  package publishing and deploy details moved to `INFRA.md`, `PACKAGES.md` and `DEPLOY.md` next to it. Removed account
  and resource IDs, hard-coded versions and duplicated content, and documented the API resume path and npm 2FA flow.
- Deployed the 7-day pause to `osrs-tracker_process-players` (version 41).
- `osrs-tracker_process-players` now pauses scraping for players that haven't been on the hiscores for 7 days in a row:
  their `scrapingOffsets` move to `pausedScrapingOffsets` and their data is kept. It sends one Discord message per
  paused player. A successful scrape ends the streak, and the API resumes scraping when the player is found again. HTTP
  400 (invalid name) is now treated like 404.
- Updated `@osrs-tracker/models` to `^0.8.0` in all Lambdas.
- Deployed `osrs-tracker_process-players` with the Node 24 upgrade, `DRY_RUN` support, `@osrs-tracker/discord-webhooks`
  0.1.0 and the 404/timeout fix, and switched its runtime to `nodejs24.x`. All 4 Lambdas now run on Node 24.
- Lowered the `osrs-tracker_process-players` timeout from 300 s to 60 s (normal batches take about 19–23 s).
- Raised the `osrs-tracker_players-to-scrape` visibility timeout from 30 s to 120 s, so a message can't be delivered
  again while it's still being processed.
- Purged the 2 messages from the dead-letter queue. Both were for players that are no longer on the hiscores.
- `osrs-tracker_process-players` no longer retries players that aren't on the hiscores (HTTP 404, e.g. renamed or
  banned). They are logged and skipped, so they no longer end up in the dead-letter queue or trigger Discord alerts.
  Only 5xx, network errors and timeouts are retried.
- Each hiscore request in `osrs-tracker_process-players` now times out after 10 seconds, so a slow response can't
  stretch a batch past the queue's visibility timeout.
- Rewrote the README in plain language: what each background job does, the shared packages, how the repo fits with the
  website and API, and how to run a job locally.
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
