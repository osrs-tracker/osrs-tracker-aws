# Changelog

Changes to the Lambdas, AWS infrastructure and CI. Package changes are logged in each `@osrs-tracker/*` package's own
`CHANGELOG.md`.

## 2026/10/10

### Compact hiscore storage

- Hiscore entries are stored in a compact format, about 89% smaller (roadmap #52): values by position in a layout (the
  new `hiscoreLayouts` collection), and a value that didn't change since the next newer entry as just its rank. The
  database's hiscore entries went from 223.9 MB to 24.2 MB, so about ten times as many players fit in Atlas's free tier.
  Cut over at 10:12–10:27 UTC with the writers stopped; the API and the website switched at the same time.
- process-players writes the new format (with `@osrs-tracker/models` 2.0.0 and `@osrs-tracker/hiscores` 4.0.0) and
  stores new layouts before the entries that use them; clean-hiscores pulls by the new date field and deletes layouts no
  entry uses any more. Deployed: process-players v48, clean-hiscores v8, queue-players v23, refresh-items v9 (the last
  two only for the models bump).
- A one-off migration script (`scripts/migrate-hiscore-entries/`) rewrote the stored entries and filled
  `hiscoreLayouts`, one player at a time, checking every player by decoding the result: 514 players, 31,822 entries, 0
  failures. Removed again after the cutover; restore it from git history (`git checkout 6e3956d -- scripts/`) if it's
  ever needed.
- If process-players can't store a hiscore layout (for example Atlas is briefly unreachable), the message's players are
  retried like a failed fetch instead of missing the day's entry with a "Failed to store hiscores" alert: nothing was
  written for them yet, so a retry can't store duplicates. Deployed: process-players v49.

### Behind the scenes

- CI type-checks the tests of packages that use Vitest and have a `tsconfig.spec.json` (models), since Vitest doesn't
  and the build covers only `src/index.ts`.

## 2026/10/09

### Lambdas

- All four Lambdas check their environment variables at startup (`envalid`). A missing, empty or invalid variable stops
  the run at once with an error naming it, instead of misbehaving quietly: an unset `PLAYERS_PER_SQS_MESSAGE` used to
  make process-players drop failed players without a retry. `DRY_RUN` must be `true` or `false`, and a Mongo username
  without a password is rejected too.
- If SQS rejects some messages in a batch, players no longer silently miss their scrape or retry: queue-players and
  process-players log them and send a Discord alert. queue-players no longer logs every queued username each hour, and
  process-players uses a local `chunk` instead of `lodash.chunk`.
- process-players and refresh-items use Node's built-in `fetch` instead of `node-fetch` (each bundle about 87 KB smaller
  before `envalid` added about 21 KB). refresh-items now fails with the HTTP status when the Wiki returns an error,
  instead of the confusing `item.map is not a function`, and gives up on a stalled request after 15 seconds.
- process-players no longer throws once it has started writing, so SQS can't retry a message and store duplicate hiscore
  entries: a failed bulk write (before, one failed write threw, and one failing while later players were still being
  scraped could crash the run), or a retry SQS rejects is logged and alerted on instead, and a Discord alert that fails
  to send is only logged. It still throws when every fetch failed and nothing was written. Discord alerts the webhook
  rejects (for example a revoked webhook) are now logged in the three Lambdas that send them instead of lost.
- Deployed all four with these changes: clean-hiscores version 5, process-players 45, queue-players 20, refresh-items 7.
- All four Lambdas depend on `@osrs-tracker/models` `^1.0.0` (three were on `^0.8.0`, which still had `sourceString`),
  and process-players on `@osrs-tracker/hiscores` `^3.1.3`, the first version that accepts models 1.0.0. The models only
  provide types here, so every bundle is byte-identical and nothing was redeployed.
- Removed the unused `OSRS_API_BASE_URL` environment variable from queue-players' live configuration (only
  process-players fetches hiscores). Code unchanged.
- The four Lambdas share one copy of their common code in `lambda/shared/` (the `DRY_RUN` switch, the MongoDB client,
  SQS sending, Discord alerts, the environment checks, the ESLint config and the build and local-run scripts) instead of
  keeping a copy each, so a fix there reaches all four. CI checks all four when it changes and now type-checks each
  Lambda, including the shared code it uses. The bundles behave the same and need no redeploy, and the build no longer
  needs `minimist`. The push hook for Claude Code checks the checkout being pushed instead of the main one.
- Discord alerts are sent by the Lambdas' shared code directly (a `fetch` POST to the webhook) instead of through the
  `@osrs-tracker/discord-webhooks` package. The Lambdas were its only users, so the package is removed from this repo
  and deprecated on npm. Deployed with the shared-code build: clean-hiscores version 6, process-players 46,
  queue-players 21 (refresh-items' bundle is unchanged).
- Fixes from reviewing the above, deployed as clean-hiscores version 7, process-players 47, queue-players 22 and
  refresh-items 8:
  - A stalled Discord request gives up after 5 seconds. Before, it could hold process-players past its timeout after the
    bulk writes, and the SQS retry would store duplicate hiscore entries.
  - An alert over Discord's 4096-character limit (such as a long player list) is cut short instead of rejected.
  - `WEBHOOK_URL` must be a valid URL at startup.
  - process-players retries a player whose scrape threw, instead of dropping it silently. When every fetch fails but a
    404 was recorded, it queues the failed players in a new message instead of failing the run, so a retry doesn't count
    the 404 twice.
  - A failed SQS send counts every message in the batch as rejected inside the shared helper, not in each Lambda.
  - Environment checks keep envalid's guard against reading undeclared variables. refresh-items now loads its
    `src/env.ts`, and times its steps with `performance.now()`.

### Packages

- Added the `@osrs-tracker/express-metrics` package (Prometheus HTTP metrics for the website and API, replacing
  `express-prom-bundle` and the deprecated `prom-client`). CI runs its Vitest tests for any package with a
  `vitest.config.ts`.
- Added the `@osrs-tracker/logger` package: the JSON logs the website and API servers each wrote by hand (request log,
  outgoing requests, errors with their stack on one line), shared on pino and pino-http so both keep the same fields for
  Loki.

### CI

- CI loads every built package with an `exports` map (`models`, `hiscores`, `express-metrics`, `logger`) with both
  `require` and `import`, directly and by package name from the packed tarball, so a build Node can't load (like
  hiscores 3.1.0 or models 0.10.0) fails CI before it's published.
- The packages' built `dist/` folders are no longer committed: nobody installs them from git, `prepublishOnly` builds
  them before every publish, and the load check above builds and packs each changed package anyway. CI drops its
  "committed dist is up to date" step, and the load check builds a peer it packs (hiscores' models). Each package's
  `files` limits its next published tarball to `dist/`, `CHANGELOG.md`, the README and the license (no more `src/`,
  tests or configs).

### Licence

- The repo is now licensed under Apache-2.0 instead of MIT: still free for anyone to use, change and ship, but a copy
  has to keep the new `NOTICE` file (crediting OSRS Tracker and Freek Mencke) and mark the files it changed, and the
  licence grants no use of the project's name. Each package ships its own `LICENSE` and `NOTICE`, from its next release;
  versions already on npm stay MIT. Released as `@osrs-tracker/models` 0.10.3, `hiscores` 3.1.2 and `express-metrics`
  0.1.1 (`logger` started out on Apache-2.0).

### Data model

- `DATA-MODEL.md` says what a normalized `players.username` is, following the API's change: lowercase, `_` and `-` as
  spaces and trimmed, as Jagex matches names, so a stored name never contains `_` or `-`. A one-off migration renamed
  the 12 players stored with `_` or `-` (9) or deleted them where the normalized player already held the same data (3).
  The Lambdas only read stored names, so none of them changed.

### Behind the scenes

- Docs audit fixes: every `aws` call in the skill, including `npm run deploy`, runs as the `claude` profile instead of
  the default one. DEPLOY.md says when each Lambda's next run is, compares the bundle size before a deploy, and rolls
  back `lambda/shared/` and the lockfile too, with the steps for redeploying an earlier version's zip. INFRA.md says how
  long each queue keeps messages, how to move or purge the dead-letter queue, and what to do for each Discord alert. The
  root README lists what each `.env` value is locally; the `.env.example` files say the Mongo user is required there.
  The `conventions-reviewer` agent diffs against `origin/main` and checks `DATA-MODEL.md`. Only queue-players reads a
  local run's event time; the skill and `lambda/shared/build/invoke.js` now say so.
- Each Lambda's README describes what it does, its trigger and environment variable names, and how to run it locally,
  instead of the old starter-template text. The root README no longer says `@osrs-tracker/hiscores` parses the old
  hiscore formats (removed in 3.0.0) and mentions that process-players pauses players who are off the hiscores.
- Added a `CLAUDE.md` for Claude Code: what the repo is, the verify and local-run commands, the hard rules and where
  things live, pointing to the project skill for detail. The `conventions-reviewer` agent checks its hard rules too.

## 2026/10/08

### Hiscore entries without `sourceString`

- Hiscore entries no longer store the old CSV-like copy of the hiscores (`sourceString`); `skills`/`activities` hold
  everything. process-players first wrote `'LEGACY'` instead (each new entry about 12% smaller, deployed as version 42),
  then stopped writing the field once `@osrs-tracker/models` 0.10.0 dropped it (models bumped from `^0.8.0`; deployed as
  version 43).
- One-off migration: the 23,164 older entries that only had the string now have `skills`/`activities` too, and
  `sourceString` was removed from every stored entry.

### Data model

- Added `DATA-MODEL.md`: who writes each field of the shared `players` and `items` collections, which side owns each
  index, the pause/resume contract with the API, and what's legacy. Linked from the README and the project skill.
  Checked against the live database, which found leftovers from older code. Dropped the two `players` indexes the check
  found unused and created by no code (`username` + `hiscoreEntries.scrapingOffset`, and `lastFetch`).
- process-players no longer creates `players.username` and refresh-items no longer creates `items.id` on every run; the
  API owns both indexes and creates them at startup.
- `DATA-MODEL.md` follows the API's changes of the day: it no longer writes `name` on its initial hiscore entries (it
  moved to the shared client) or `sourceString: 'LEGACY'`, so older entries with `name` age out; it no longer creates
  `players.username` per request or returns `hiscoreEntries: null`. It now describes only the current state: the
  migration history, dropped indexes and dated snapshot counts are gone (they stay in this changelog and git history).

### Shared hiscore client

- process-players fetches hiscores with `getHiscore` from `@osrs-tracker/hiscores` 3.1.0 (new dependency) instead of its
  own copy, which the API is moving to as well. Names are now URL-encoded, and a response counts as valid when it has
  `skills` and `activities` arrays. The old check that the returned `name` equals the queried one is gone: Jagex echoes
  the name exactly as queried, so it never caught anything. Still `node-fetch` with the keep-alive agent; failure logs
  now include the reason. Deployed as process-players version 44 and refresh-items version 6 (index cleanup).
- Bumped process-players to `@osrs-tracker/hiscores` 3.1.1 (CommonJS build so the API can load it in plain Node). Its
  bundle is byte-identical, so it isn't redeployed.

### Behind the scenes

- Project skill: when adding a changelog entry (root or package), reread the whole day to add subtitles once it's busy
  and merge entries about the same feature. A new hiscores skill or activity only needs its enum member now that the
  parse orders are gone; the `conventions-reviewer` agent no longer checks parse orders.
- Prettier ignores `.claude/settings.local.json`, which Claude Code rewrites in its own layout when a permission is
  allowed, so it no longer fails the Prettier check that guards every push.

## 2026/10/07

- CI reuses each project's installed `node_modules` until its `package-lock.json` changes, instead of running `npm ci`
  every time. A new push to a PR only checks the packages and Lambdas changed since the previous push, so a version or
  lockfile bump doesn't recheck the whole PR; a change under `.github/` (workflow or action) still checks everything. If
  CI didn't pass on the previous push, a PR is checked against its base again and a push to `main` checks everything, so
  a failed folder can't turn green by pushing an unrelated change on top.
- Claude Code: edited files are formatted with Prettier automatically, a push is blocked when the Prettier check or a
  Lambda's lint fails, and a `conventions-reviewer` agent reviews PRs against the project skill during a release.

## 2026/10/04

- Project skill: documented the changelog conventions (`###` subtitles on busy days, no near-duplicate entries).

## 2026/10/03

- Project skill: documented the release flow (PR, review, deploy and publish, update the PR, merge).
- Removed the unused `commitizen` and `cz-conventional-changelog` dev dependencies and their `config.commitizen` blocks
  (root and all 4 Lambdas). Nothing used them, and they were the only source of the remaining root `npm audit` findings,
  so the root now reports 0 vulnerabilities.
- Ran `npm audit fix` in the repo root and all 4 Lambdas to patch vulnerable dev dependencies (eslint and commitizen
  dependencies such as `lodash`, `@humanfs/node`, `minimatch`, `js-yaml` and `tmp`). Production dependencies are
  unchanged, so no deploy is needed.
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
