---
name: osrs-tracker-aws
description:
  Rules and workflow for osrs-tracker-aws (AWS Lambdas and the `@osrs-tracker/*` npm packages). Use when writing or
  reviewing Lambda or package code, running a Lambda locally, adding a new hiscores skill or activity, publishing a
  package, deploying a Lambda, inspecting or changing AWS resources (API Gateway proxy, EventBridge, SQS, Lambda
  config), or committing, pushing, releasing or shipping this repo.
---

# osrs-tracker-aws

Scheduled and SQS-driven Lambdas (`lambda/<function>/`, one npm project each) that keep OSRS Tracker's MongoDB data
fresh, plus the packages in `@osrs-tracker/`. Consumers `../osrs-tracker-web` and `../osrs-tracker-api` have their own
skills.

**This repo is public.** Never write secret values, account IDs or resource IDs into code, docs or commits, and never
print `.env` values.

Load when needed: [DATA-MODEL.md](../../../DATA-MODEL.md) (who writes which `players`/`items` field and owns which
index; update it with any field or index change), [INFRA.md](INFRA.md) (AWS resources, infra changes),
[PACKAGES.md](PACKAGES.md) (new hiscores skills and activities, versioning, publishing), [DEPLOY.md](DEPLOY.md) (deploy
and rollback). The `conventions-reviewer` agent reviews diffs against these files at runtime, so keep rules here, not in
the agent.

## Rules

- **Mutating `aws` commands** hit production (no IaC, broad default profile): follow [INFRA.md](INFRA.md). Read-only
  calls are fine.
- **Lambda deploys** go live immediately and **npm publishes** are public and irreversible: get explicit go-ahead.
- **Every write goes through a `DRY_RUN`-aware helper** (`lambda/shared/src/dry-run.utils.ts`): Mongo writes in `MU`,
  `sendMessageBatch`, `discordAlert`. Guard new writes with `if (DRY_RUN) return logDryRun(…)`.
- **Run handlers locally only via `npm run invoke:dry`** (from `lambda/<function>/`, `.env` filled in). There is no
  staging database. Reads and fetches are real; writes log `[DRY_RUN] Would …`. Scheduled Lambdas take an optional event
  time (`-- 2026-10-02T18:00:00Z`), process-players takes usernames (`-- Zezima "Lynx Titan"`). It overwrites `dist/`
  with a dev build, so `npm run build` before comparing bundles.

## Lambda notes

- Create clients at module scope so warm invocations reuse them.
- Code every Lambda needs lives once in `lambda/shared/` (no `package.json`, bundled into each Lambda), imported as
  `@lambda/shared/<module>`: `src/` holds `env.ts` (`sharedEnv`: the MongoDB variables and `DRY_RUN`, the only ones
  shared code reads; `cleanLambdaEnv` adds the Lambda's own schema from its `src/env.ts`), `dry-run.utils.ts`,
  `mongo.utils.ts` (each Lambda's `MU` extends `mongoUtils<Schema>()` with its own queries; `ensureIndex`),
  `sqs.utils.ts` and `discord-alert.ts` (the Lambda passes its queue or webhook URL; `discordAlertNeverRejects` for code
  that must not throw); `build/` holds `esbuild.js` and the `invoke.js` runner; `eslint.config.mjs` is every Lambda's
  ESLint config. Its imports resolve from the Lambda being built or checked (esbuild `alias` and `nodePaths`, `paths` in
  `lambda/tsconfig.lambda.json`). Keep Lambda-specific logic in the Lambda.
- `MU.client()` uses `MONGODB-AWS` from the role, or SCRAM when `MONGODB_USERNAME` is set (local and the API). mongodb 7
  **rejects an explicit username/password with `MONGODB-AWS`**.
- Throw to fail a run (SQS retries it); use `discordAlert` for operator-visible failures. process-players must not throw
  after its bulk writes: the retry would store duplicate hiscore entries.
- Only process-players counts 404s: a 404/400 hiscore is skipped and starts a date-based streak; after 7 days the
  player's `scrapingOffsets` move to `pausedScrapingOffsets`. The API's `refreshPlayerInfo` restores them (full contract
  in [DATA-MODEL.md](../../../DATA-MODEL.md)).

## Verify

- Each touched Lambda: `npm run lint && npm run prettier:ci && npx tsc --noEmit -p . && npm run build` (esbuild doesn't
  type-check; `tsc` also checks the shared files that Lambda imports, and CI runs it). A change in `lambda/shared/`
  touches all four. process-players' `npm run lint` lints `lambda/shared/`; the root `npm run prettier:ci` formats it.
- `@osrs-tracker/hiscores`: `npx jest && npm run build` (`npm test` is watch mode)
- `@osrs-tracker/express-metrics`, `@osrs-tracker/logger`: `npx vitest run && npm run build` (`npm test` is watch mode)
- `@osrs-tracker/models`: `npm run build`
- Repo root: `npm run prettier:ci`

Packages' `dist/` isn't committed: `prepublishOnly` builds it, and CI builds each changed package and loads it from the
packed tarball.

## Release ("release it", "ship it")

Run the whole flow without asking between steps; stop only on failure. The request is the go-ahead to deploy and publish
what the change touches; mutating infra commands still need their own approval. Verify locally once before committing;
after that CI is the gate (builds needed for a deploy or publish still run).

1. Commit on a `<type>/<short-name>` branch, push, `gh pr create --base main`.
2. Review `gh pr diff` for bugs and leftovers while the `conventions-reviewer` agent checks the PR; fix both and push.
3. Once CI passes, deploy changed Lambdas ([DEPLOY.md](DEPLOY.md)) and publish changed packages
   ([PACKAGES.md](PACKAGES.md)), and check they work.
4. Commit version or lockfile bumps, push, and record what shipped and the check results in the PR description.
5. Once checks pass: `gh pr merge <n> --merge`, switch to `main`, pull, `git branch -d <branch>`, `git fetch --prune`.

## Commit and push

- Doc-only changes (skills, docs) go straight to `main`. Otherwise, outside a release, **ask every time**: `main` or a
  PR. The admin account bypasses `main`'s PR rule; after a direct push, `gh run watch --exit-status`. After a PR merges,
  do release step 5's cleanup.
- Deploying or publishing from a PR branch ships unmerged code: tell the user, and don't deploy from `main` until it's
  merged. Commit and push in the same session as any deploy or publish.
- Conventional commits. Scopes: `hiscores`/`models`/…, `lambda` or `osrs-tracker_<function>`, `ci(actions)`,
  `docs(skill)`.
- **Every change gets a changelog entry**: Lambda, infra and CI changes (including deploys) in the root `CHANGELOG.md`
  under `## YYYY/MM/DD` (newest first); package changes in the package's `CHANGELOG.md` ([PACKAGES.md](PACKAGES.md)).
  Busy days get `###` subtitles by area ("Behind the scenes" last), not repeated in their entries. Extend an existing
  entry rather than add a near-duplicate. When adding an entry, reread the whole day: add subtitles once it's busy, and
  merge entries about the same feature.
- GPG "Inappropriate ioctl for device": ask the user to run `echo test | gpg --clearsign > /dev/null` in their terminal.
  Never use `--no-gpg-sign`.
- `gh pr edit` can fail on a Projects (classic) error; use
  `gh api -X PATCH repos/osrs-tracker/osrs-tracker-aws/pulls/<n> -F body=@<file>`.
