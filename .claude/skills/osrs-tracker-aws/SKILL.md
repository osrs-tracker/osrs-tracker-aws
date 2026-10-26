---
name: osrs-tracker-aws
description:
  Rules and workflow for osrs-tracker-aws (the AWS Lambdas). Use when writing or reviewing Lambda code, running a Lambda
  locally, deploying a Lambda, inspecting or changing AWS resources (API Gateway proxy, EventBridge, SQS, Lambda
  config), or committing, pushing, releasing or shipping this repo.
---

# osrs-tracker-aws

Four Lambdas (`lambda/<function>/`, one npm workspace at the repo root). queue-players (hourly) invokes process-players,
which with record-player-count (every 10 minutes) scrapes OSRS Tracker's player data into a queue for osrs-tracker-api's
ingester, which applies it to MongoDB; alarm-to-discord posts the CloudWatch alarms to Discord. The `@osrs-tracker/*`
npm packages they install live in `../osrs-tracker-packages`
([osrs-tracker-packages](https://github.com/osrs-tracker/osrs-tracker-packages)): a package change (a new hiscores skill
or activity, a model field) is a PR and a publish there, then a version bump here. That repo, `../osrs-tracker-web` and
`../osrs-tracker-api` have their own skills.

**This repo is public.** `CLAUDE.md`'s hard rules say what never goes into code, docs, issues or commits, and what is
never printed.

Load when needed: osrs-tracker-api's
[DATA-MODEL.md](https://github.com/osrs-tracker/osrs-tracker-api/blob/main/DATA-MODEL.md) (the collections, the
subscriptions table and the pause/resume contract; a change to a scrape result message needs an issue there),
[INFRA.md](INFRA.md) (AWS resources, infra changes), [DEPLOY.md](DEPLOY.md) (deploy and rollback). The
`conventions-reviewer` agent reviews diffs against these files at runtime, so keep rules here, not in the agent;
repo-specific review rules go in `## Review rules`.

## Rules

- **Mutating `aws` commands** hit production (no IaC): follow [INFRA.md](INFRA.md). Read-only calls are fine. Run every
  `aws` call, including the ones inside `npm run deploy` and `update:runtime`, as the `claude` profile
  (`--profile claude` or `AWS_PROFILE=claude`), never the default profile.
- **Lambda deploys** go live immediately: get explicit go-ahead.
- **Every write goes through a `DRY_RUN`-aware helper** (`lambda/shared/src/dry-run.utils.ts`): `invokeAsync`,
  `sendScrapeResult`, `discordAlert`. Guard new writes with `if (DRY_RUN) return logDryRun(…)`.
- **Run handlers locally only via `npm run invoke:dry`** (from `lambda/<function>/`, `.env` filled in). There is no
  staging database. Reads and fetches are real; writes log `[DRY_RUN] Would …`. queue-players takes an optional event
  time (`-- 2026-10-02T18:00:00Z`; the other scheduled Lambdas accept it but ignore it), process-players takes usernames
  (`-- Zezima "Lynx Titan"`), alarm-to-discord `-- OK` (a recovery instead of an alarm). It overwrites `dist/` with a
  dev build, so `npm run build` before comparing bundles.

## Lambda notes

- Create clients at module scope so warm invocations reuse them.
- Code every Lambda needs lives once in `lambda/shared/` (the workspace package `@lambda/shared`, bundled into each
  Lambda), imported as `@lambda/shared/<module>`: `src/` holds `env.ts` (`sharedEnv`: `DRY_RUN`, validated at load;
  `cleanLambdaEnv` adds the Lambda's own schema from its `src/env.ts`), `dry-run.utils.ts`, `lambda.utils.ts`
  (`invokeAsync`: an async invoke that never rejects), `sqs.utils.ts` (`sendScrapeResult`: a send to the scrape results
  queue, in the message's FIFO group, that rejects when SQS doesn't take it) and `discord-alert.ts` (the Lambda passes
  its function name, queue or webhook URL; `discordAlertNeverRejects` for code that must not throw;
  `options.functionName` for an alert about another function), `commit.ts` (`logCommit()`, called at module scope in
  every `src/index.ts`: logs the commit `esbuild.js` stamps into the bundle), `user-agent.ts` (`USER_AGENT`, sent with
  every outgoing request: the OSRS Wiki asks for one; use it for any new fetch); `build/` holds `esbuild.js` and the
  `invoke.js` runner; `.oxlintrc.json` is every Lambda's oxlint config (oxlint, not ESLint, while the repo is on
  TypeScript 7, which typescript-eslint doesn't support as of 2026-10-18). Keep Lambda-specific logic in the Lambda.
- Dependencies: devDependencies go in the root `package.json`, a runtime dependency in the Lambda that imports it
  (`npm install <pkg> -w lambda/<folder>`, from the root). Shared code's imports resolve from the root `node_modules`:
  each package `lambda/shared/src/` imports is a `peerDependency` of `@lambda/shared`, which keeps the Lambdas' version
  hoisted there (without one, another package's older version can take that place, and a bundle gets two). Add one for a
  new import, and bump its range with the Lambdas'.
- Throw to fail a run (Lambda retries it per [INFRA.md](INFRA.md)'s async retries); use `discordAlert` for
  operator-visible failures. process-players throws only until its results are sent (nothing to send, or the send
  failed): after the send, a retry would requeue its failed players a second time.
- process-players and record-player-count write nothing to MongoDB since #166, and no Lambda has MongoDB code or access
  since #168: the ingester in osrs-tracker-api applies their scrape results queue messages. Only the ingester counts
  404s, from the `notFound` usernames process-players sends: a 404/400 hiscore starts a date-based streak; after 7 days
  the player's `scrapingOffsets` move to `pausedScrapingOffsets`. The API's `refreshPlayerInfo` restores them (full
  contract in osrs-tracker-api's
  [DATA-MODEL.md](https://github.com/osrs-tracker/osrs-tracker-api/blob/main/DATA-MODEL.md#pauseresume-contract)).

## Verify

- Each touched Lambda: `npm run lint && npx tsc --noEmit -p . && npm run build` (esbuild doesn't type-check; `tsc` also
  checks the shared files that Lambda imports, and CI runs it), plus `npx vitest run` in a Lambda with a
  `vitest.config.mts` (all four). A change in `lambda/shared/` touches all four. process-players' `npm run lint` lints
  `lambda/shared/` and its `npx vitest run` runs `lambda/shared/`'s specs; the root `npm run prettier:ci` formats it.
- Repo root: `npm run prettier:ci`, `npm run knip` (unused files, exports and dependencies) and `npm run jscpd`
  (copy-pasted code in `lambda/`, over 1% of its lines fails). `import/no-cycle` in `lambda/shared/.oxlintrc.json` fails
  a Lambda's lint on a circular import.

## Review rules

What `conventions-reviewer` checks beyond the rules above. It reads this section; keep repo rules here, not in the
agent.

- Read [INFRA.md](INFRA.md) when it touches AWS configuration or infra docs, [DEPLOY.md](DEPLOY.md) when it changes how
  a Lambda is deployed, and osrs-tracker-api's
  [DATA-MODEL.md](https://github.com/osrs-tracker/osrs-tracker-api/blob/main/DATA-MODEL.md) when it changes a scrape
  result message or how queue-players reads the subscriptions table (it needs an issue in osrs-tracker-api). The
  reviewer can't fetch URLs: read the local copy, `osrs-tracker-api/DATA-MODEL.md` next to the main checkout
  (`../osrs-tracker-api/` from it, `../../../../osrs-tracker-api/` from a worktree in `.claude/worktrees/`); without
  one, make it a **check** item.
- A missing `DRY_RUN` guard may live in a helper in the Lambda's `src/utils/` or in `lambda/shared/src/`: check there
  before flagging.
- Rules that span files, checked against the whole diff: a change and its `CHANGELOG.md` entry, except where `CLAUDE.md`
  exempts it.
- **breaks** here also covers: writes to production in a dry run, leaks a secret, account ID or resource ID. A typical
  **check**: a Lambda's live configuration (name the function and the setting; the caller runs the read-only `aws` call
  with `--profile claude`, since the reviewer can't run `aws`).

## Release ("release it", "ship it")

Run the whole flow without asking between steps; stop only on failure. The request is the go-ahead to deploy what the
change touches; mutating infra commands still need their own approval. Verify locally once before committing; after that
CI is the gate (builds needed for a deploy still run).

1. Commit on a `<type>/<short-name>` branch, push, `gh pr create --base main`.
2. Review `gh pr diff` for bugs and leftovers while the `conventions-reviewer` agent checks the PR (spawn it without a
   `model`, which would override its Sonnet pin). Its first line is a `VERDICT:`; check each finding against the code
   before fixing it and drop the ones that don't hold. Fix both and push.
3. Once CI passes, deploy changed Lambdas ([DEPLOY.md](DEPLOY.md)) and check they work: a Lambda's new `CodeSha256` and
   a clean next run (DEPLOY.md steps 4 and 5).
4. Commit lockfile bumps, push, and record what shipped and the check results in the PR description.
5. Once checks pass: `gh pr merge <n> --merge`, switch to `main`, pull, `git branch -d <branch>`, `git fetch --prune`.

## Commit and push

- Doc-only changes (as `CLAUDE.md` defines them) go straight to `main`, without the verify skill. CI's link check fails
  `main` on a broken local link or `#anchor`, so run it first on the tracked files (a glob would also check
  `node_modules`): `lychee --offline --include-fragments $(git ls-files '*.md')`. Otherwise, outside a release, **ask
  every time**: `main` or a PR. The admin account bypasses `main`'s PR rule; after a direct push,
  `gh run watch --exit-status`. After a PR merges, do release step 5's cleanup.
- PRs need the `CI` and `zizmor` checks, up to date with `main` (the `main` ruleset). The same ruleset blocks a merge on
  CodeQL code scanning (default setup, `default` suite) alerts of high severity or higher, or of `error` level: fix the
  alert, or dismiss it with a reason in the Security tab, and never copy an open alert's details into an issue, PR,
  commit or `CHANGELOG.md` (it's a vulnerability report in a public repo).
- That rule also blocks a PR CodeQL never analysed: default setup skips a PR that changes no JS/TS or workflow file
  (seen on #134, #137 and #140; GitHub doesn't document it), so the PR stays BLOCKED with no `CodeQL` check. Once `CI`
  and `zizmor` pass and `gh pr checks <n>` lists no `CodeQL`, merge with `gh pr merge <n> --merge --admin`. `--admin`
  skips every rule, so never use it while a check fails or is pending (osrs-tracker/osrs-tracker-packages#11).
- Deploying from a PR branch ships unmerged code: tell the user, and don't deploy from `main` until it's merged. Commit
  and push in the same session as any deploy.
- Conventional commits. Scopes: `lambda` or `osrs-tracker_<function>`, `infra` (snapshots), `ci(actions)`,
  `docs(skill)`, `docs(changelog)`.
- **Changelog entries**: which changes get one, and where, is in `CLAUDE.md` (deploys count). Root days are
  `## YYYY-MM-DD`, newest first. Say what changed and why. Busy days get `###` subtitles by area ("Behind the scenes"
  last), not repeated in their entries. Extend an existing entry rather than add a near-duplicate. When adding an entry,
  reread the whole day: add subtitles once it's busy, and merge entries about the same feature.
- GPG "Inappropriate ioctl for device": ask the user to run `echo test | gpg --clearsign > /dev/null` in their terminal.
  Never use `--no-gpg-sign`.
- `gh pr edit` can fail on a Projects (classic) error; use
  `gh api -X PATCH repos/osrs-tracker/osrs-tracker-aws/pulls/<n> -F body=@<file>`.
