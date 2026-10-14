# Changelog

Changes to the Lambdas, AWS infrastructure and CI. Package changes are logged in each `@osrs-tracker/*` package's own
`CHANGELOG.md`. Housekeeping (tooling, CI) is logged on purpose, because sessions read this as the repo's history;
doc-only changes are not.

## 2026-10-14

### Player counts

- record-player-count stores each UTC day's averages in a new `playerCountsDaily` collection (issue #125, for
  osrs-tracker/osrs-tracker-api#159), so the API's `1y` and `all` history can read one small document per day instead of
  averaging every sample on each request: measured on 10 years of samples, `all` took 6.5 s, past the web's 3 s SSR
  timeout. After inserting its sample, each run recomputes the days from the newest stored day on (normally only today;
  every sample on the first run, which is the backfill) with one aggregation ending in `$merge`, so a failed or repeated
  run is repaired by the next one instead of skewing a running sum for good. The grouping and rounding are the API's, so
  its answers don't change. A failed recompute alerts on Discord (`Daily player counts not updated`) but doesn't fail
  the run: the sample is stored. New env var `MONGODB_DAILY_COLLECTION`, set on the live function before the deploy; the
  documents are `PlayerCountDay` from `@osrs-tracker/models` 2.5.0. Deployed as version 3, commit 3348c4e (rebased as
  3a0f7bd, same code).

### Infra

- clean-hiscores gets 60 s and 256 MB (was 10 s and 128 MB), and clean-hiscores and queue-players no longer retry a
  failed run (issue #105, from the tech-debt roadmap #103). clean-hiscores peaked at 5 s and 106 MB over the last week,
  and its work grows about 1.5× as entries reach the 90-day steady state (`DATA-MODEL.md`); a timeout part-way would
  skip the later clean-ups and the "No hiscores scraped" check. Lambda's default two retries sent that alert up to three
  times a night, and a queue-players retry after its first SQS send would queue the hour's players again. refresh-items
  keeps its retries (idempotent upserts). INFRA.md now lists every function's timeout, memory and retries.

### Behind the scenes

- Every Lambda's and package's Vitest config is `vitest.config.mts` (issue #108, from the tech-debt roadmap #103): Vite
  warned that the `.ts` ones use ESM syntax in a file loaded as CommonJS, which its native config loader, planned as a
  future default, doesn't support. CI and `verify.sh` find the config as `vitest.config.*`, and the Lambdas' ESLint
  config lints `.mts` files. clean-hiscores, process-players, record-player-count and refresh-items move to
  `mongodb-memory-server` 11 (still MongoDB 8.0.12 in memory). Tests only; not deployed.
- CI drops its Jest step: `@osrs-tracker/hiscores` tests run on Vitest (issue #107), so its package job runs the same
  Vitest and `tsc -p tsconfig.spec.json` steps as models', and `verify.sh` does the same.
- process-players' handler is split (issue #115, from the tech-debt roadmap #103): `scrapeMessage` in
  `src/utils/scrape-message.ts` scrapes one message's players and stores their layouts, and `afterWrites` in
  `src/utils/after-writes.ts` waits for the bulk writes, requeues the failed players and sends the alerts. The handler
  keeps the loop that starts each message's write and its one throw, which now sits right before `afterWrites`, the
  boundary after which nothing may throw. Its ESLint complexity drops from 16 to 8. New specs cover the staggered
  requests, the entries' shared scrape time and offset, requeueing per offset in batches of 10 messages, and the "Failed
  to process some players" alert on a redelivered message. Same messages, writes and alerts: `invoke:dry` logs the same
  lines. Deployed as version 51, commit 027d111, which also ships process-players' Node built-ins refactor (2026-10-13),
  its cold-start commit log (#114) and the `models` 2.4.0 and `hiscores` 4.2.0 bumps (#104). Its zip grows from 372 to
  427 KB while the bundle grows by 1 KB: bestzip 4 (#104) compresses less than 2.2.7.
- queue-players' offset for the hour and its batching move to `src/utils/queue.utils.ts` (`scrapingOffsetForHour`,
  `messageBatches`), with Vitest tests (issue #112, from the tech-debt roadmap #103): an off-by-one in either would
  silently skip players for the day. The specs pin hours 0, 11, 12 and 23 UTC to offsets 0, 11, -12 and -1, and 0, 1,
  one message's worth and ten messages' worth plus one usernames to the right messages and `SendMessageBatch` calls. Its
  `vitest.config.ts` resolves `@lambda/shared` imports as the build does and sets the MongoDB variables the shared
  `env.ts` validates. What gets queued is unchanged (`invoke:dry` at 00:00, 12:00 and 18:00 UTC sends the same
  messages); not deployed.
- Lambda tooling cleanup (issue #104, from the tech-debt roadmap #103). All five `tsconfig.json` now `include`
  `src/**/*.ts`, so `npx tsc --noEmit -p .` also type-checks spec files, which Vitest doesn't. The unused `npm start`
  script goes, with the `--watch` and `--run` options of `lambda/shared/build/esbuild.js` and
  `@es-exec/esbuild-plugin-start`. ESLint no longer has formatting rules that fight Prettier (`@stylistic/*`,
  `comma-dangle`, `no-multiple-empty-lines`), so `@stylistic/eslint-plugin` and the unused `eslint-config-prettier` are
  dropped. Each Lambda points at the root `.prettierrc.json` instead of a copy, and its `.vscode/settings.json` goes, so
  the root's editor formatter applies. `@osrs-tracker/models` goes to 2.4.0 (four Lambdas) and `@osrs-tracker/hiscores`
  to 4.2.0 (process-players), and `bestzip` to 4. The bundles are unchanged, except process-players' minified
  identifiers; not deployed.
- Every Lambda logs the commit its bundle was built from at each cold start (`Built from commit 1a2b3c4`, issue #114),
  so a deployed version can be tied to its code instead of only to a changelog line. `lambda/shared/build/esbuild.js`
  stamps it from `git rev-parse --short HEAD`, with `-dirty` when `lambda/` has uncommitted changes and `unknown`
  without git; `logCommit()` in `lambda/shared/src/commit.ts` logs it. Deploy notes now record the commit next to the
  version (DEPLOY.md). Each Lambda picks it up at its next deploy.
- clean-hiscores has tests (issue #111), since it deletes data every night: its four clean-ups and their `DRY_RUN`
  branches run against MongoDB 8.0.12 in memory on fixture players (the 180-day offset drop first deletes real data in
  April 2027), and the handler spec pins their order and the alert before the throw when nothing was scraped in 2 days.
  refresh-items and record-player-count have handler tests too (issue #113), against MongoDB in memory with the Wiki,
  the world list and Discord stubbed. refresh-items: an empty item list or a non-2xx response fails the run and deletes
  nothing, and 50 items missing from the Wiki's list are removed while 51 skip the delete. record-player-count: a failed
  request, a list that doesn't parse, or 0 worlds or players sends the alert, stores nothing and fails with the world
  list's error even when the alert fails; otherwise it stores one document with the counts and the run's date.
  `lambda/tsconfig.lambda.json` sets `skipLibCheck`: Vitest's declarations don't type-check under the Lambdas'
  `moduleResolution: node`. Every Lambda's `npm test` runs Vitest in watch mode, as in the packages, and every Lambda's
  specs get the same dummy environment: `DRY_RUN=false` and a MongoDB URI on port 1, where a connection made by mistake
  fails at once. No behaviour change; not deployed.
- process-players gets its first tests (issue #110, from #103): Vitest, plus an in-memory MongoDB 8.0
  (`mongodb-memory-server`) as in `@osrs-tracker/models`. They pin the rule that it must not throw after its bulk
  writes, fixed four times on 2026-10-09 and 2026-10-10 without a test: the handler resolves once a write started (a
  failed write, also one that fails while a later message is scraped, a retry batch SQS rejects or fails to send, a
  failed alert), throws only when nothing was written and no 404 recorded, and requeues failed players and those of a
  message whose layouts failed to store. The not-found streak and pause and the layout id collision check run against
  MongoDB. `lambda/shared/` gets specs for `sendMessageBatch`, the Discord alert (truncation, non-2xx, 5 s timeout) and
  the env validators; they run, and are type-checked, from process-players, which already lints it. The bundle is
  unchanged; not deployed.

## 2026-10-13

### Lambdas

- New Lambda record-player-count (issue #88): every 10 minutes it sums the players on Jagex's world list (the binary
  `slr.ws` the client's World Select uses) and stores one `PlayerCount` (`@osrs-tracker/models` 2.4.0) in the new
  `playerCounts` collection, kept forever, for the player count chart (osrs-tracker/osrs-tracker-api#146,
  osrs-tracker/osrs-tracker-web#255). A failed request, a response that doesn't parse, or 0 worlds or players inserts
  nothing and sends the `Player count not recorded` alert. Its parser is the first Lambda code with tests (Vitest, on a
  captured response); CI and the `verify` skill run them for any Lambda with a `vitest.config.ts`, and `verify.sh` now
  finds the Lambda folders itself. Created in the console (256 MB, 30 s, arm64, role `AWS_Lambda`, async retries off),
  deployed as version 1, triggered by the new EventBridge rule `osrs-tracker_record-player-count` (`rate(10 minutes)`);
  its log group keeps 7 days like the others.
- record-player-count's world list client and parser moved to `@osrs-tracker/hiscores` 4.2.0 (`fetchWorldList`,
  `parseWorldList`), with their tests, so osrs-tracker-api can serve a live count with the same parser (issue #100,
  osrs-tracker/osrs-tracker-api#163). The Lambda still fetches Jagex itself, with the same timeout, user agent, checks
  and alert, so recording doesn't depend on the API. It no longer has tests of its own, so it drops Vitest; CI and
  `verify.sh` still run them for any Lambda with a `vitest.config.ts`. Deployed as version 2.
- clean-hiscores keeps hiscore entries 90 days instead of 60 (`MAX_AGE_IN_DAYS`), for goal dates and day comparisons in
  the web app; players nobody scraped or looked up are now also deleted after 90 days. The history reaches 90 days on
  2026-11-12. Its nightly alert now fires when no player got an entry in the last 2 days (scraping stopped), renamed
  `No hiscores scraped`, instead of when it found nothing to remove, which would have alerted every night until then and
  only noticed a stopped scrape 60 days late. Deployed as version 13, then `MAX_AGE_IN_DAYS` set to 90.
- refresh-items reads the item list from v2 of the OSRS Wiki prices API (`/api/v2/osrs/mapping`) instead of v1, which
  the Wiki says may be removed. The response is the same. Deployed as version 11.
- process-players' hiscore requests to Jagex and every Lambda's Discord alerts now send the
  `User-Agent: github:osrs-tracker/osrs-tracker-aws` that refresh-items already sent to the Wiki, instead of undici's
  `node`, so the receiver can tell where to report a problem. The value is one constant, `USER_AGENT` in
  `lambda/shared/src/user-agent.ts`. Deployed as clean-hiscores 12, process-players 50, queue-players 24 and
  refresh-items 12.

### Behind the scenes

- A new `.worktreeinclude` copies each Lambda's `.env` from the main checkout into new Claude Code worktrees, so
  `npm run invoke:dry` works there without copying it by hand.
- CI gets a `Link check` job (lychee, offline) that fails on a broken local link or `#anchor` in any Markdown file,
  `.claude/` included, on every push, doc-only ones too (issue #95). Changelog days are now ISO dates (`2026-10-13`),
  and package entries drop the `v` (`## 4.1.0 - 2026-10-10`), the same in all osrs-tracker repos.
- process-players uses Node built-ins instead of hand-written helpers: `setTimeout` from `node:timers/promises` for the
  staggered hiscore requests and `isDeepStrictEqual` from `node:util` for the layout collision check. A bulk write is
  settled with `.then` instead of `Promise.allSettled` on a single promise, and `mapArrayPush` appends in place instead
  of copying the array. No change in behaviour; deployed with process-players 51 on 2026-10-14.

## 2026-10-12

### Behind the scenes

- The `conventions-reviewer` agent is the one shared with osrs-tracker-web: it runs Sonnet at medium effort with the
  `osrs-tracker-aws` skill preloaded, starts its report with a `VERDICT:` line and reports at most 3 **check** items. A
  new hook, `.claude/hooks/read-only-bash.sh`, limits its Bash to single git, gh and grep reads, so it can't run `aws`,
  `npm publish` or git writes. Its AWS-specific rules moved to the skill's new `## Review rules` section. The release
  flow reads its verdict and checks each finding against the code before fixing it.
- The pre-push gate moved to `.claude/hooks/pre-push-check.sh`, adapted from osrs-tracker-web's. It also catches
  `git -C <path> push`, `git -c … push` and chained commands, which the old `Bash(git push*)` filter let through, and
  checks the checkout being pushed (the `-C` path or the command's cwd) instead of the hook's own. It now starts only
  for git commands (`"if": "Bash(git *)"`), not on every Bash call.
- A new `verify` skill runs the verify checks for the Lambdas and packages a staged change touches, plus the root
  Prettier check. Claude Code runs it before each commit. Its script, `.claude/skills/verify/verify.sh`, runs every
  check at once in one call (about 8 s instead of 17 s for a change to `lambda/shared/` and `models`), never stopping at
  a failure, and prints only the failed checks' logs plus a summary line per check, so all failures get fixed in one
  round.

## 2026-10-10

### Unused scraping offsets

- clean-hiscores drops a player's scraping offset that nobody looked up for 180 days, with all its hiscore entries, so a
  player isn't scraped once per offset forever after a single lookup from another timezone (worst case 24 times a day).
  It always keeps the most recently looked up offset, so every player is still scraped once a day. Lookups are recorded
  per offset by osrs-tracker-api in the new `scrapingOffsetLookups`; offsets without a date get the date of the run, so
  nothing is dropped before 2027-04. Deployed: clean-hiscores v11; its first run at 00:00 UTC on 2026-10-11 dates every
  offset.

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
- clean-hiscores also deletes players that have no hiscore entries left (not scraped or looked up for 60 days); a lookup
  creates them again. Its first run deletes the 153 players without entries. The alert for a night with nothing to pull
  now comes after the clean-ups, so they run every night. Deployed: clean-hiscores v9, then v10; triggered once by hand
  on 2026-10-10 at 11:59 UTC, which deleted the 153 players (and sent the expected "nothing to pull" alert).

### Items no longer on the GE

- refresh-items deletes the items that left the OSRS Wiki's item list (items Jagex took off the Grand Exchange, which
  have no prices and only made thin pages on the website), after its hourly upsert (#73). It skips the delete when more
  than 50 items would go, so a truncated Wiki response never wipes the collection. The 19 that had piled up were removed
  by hand on 2026-10-10 before this. Deployed: refresh-items v10.
- `DATA-MODEL.md` follows the API's item browse and player sitemap (#72): the `items` `{ name: 1 }` index (collation
  `en`, strength 2) that `browseItems` hints, and `GET /sitemap/players` reading `scrapingOffsets`,
  `hiscoreNotFoundCount` and the newest `hiscoreEntries` date.

### Behind the scenes

- Prettier skips `.claude/worktrees/`, so another session's unfinished files there no longer fail the repo-wide check or
  block a push.
- CI type-checks the tests of packages that use Vitest and have a `tsconfig.spec.json` (models), since Vitest doesn't
  and the build covers only `src/index.ts`.
- The root `package.json` declares the repo's Apache-2.0 license instead of MIT, matching `LICENSE` and every Lambda and
  package (#58).
- queue-players no longer passes `background: true` when it ensures its `scrapingOffsets` index; MongoDB has ignored
  that option since 4.2. A review of every index against the current queries (2026-10-10) found nothing else to change
  here. Not deployed yet.

## 2026-10-09

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

## 2026-10-08

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

## 2026-10-07

- CI reuses each project's installed `node_modules` until its `package-lock.json` changes, instead of running `npm ci`
  every time. A new push to a PR only checks the packages and Lambdas changed since the previous push, so a version or
  lockfile bump doesn't recheck the whole PR; a change under `.github/` (workflow or action) still checks everything. If
  CI didn't pass on the previous push, a PR is checked against its base again and a push to `main` checks everything, so
  a failed folder can't turn green by pushing an unrelated change on top.
- Claude Code: edited files are formatted with Prettier automatically, a push is blocked when the Prettier check or a
  Lambda's lint fails, and a `conventions-reviewer` agent reviews PRs against the project skill during a release.

## 2026-10-04

- Project skill: documented the changelog conventions (`###` subtitles on busy days, no near-duplicate entries).

## 2026-10-03

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

## 2026-10-02

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
