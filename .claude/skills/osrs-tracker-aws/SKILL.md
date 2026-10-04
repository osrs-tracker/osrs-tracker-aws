---
name: osrs-tracker-aws
description:
  Rules and workflow for osrs-tracker-aws (AWS Lambdas and the `@osrs-tracker/*` npm packages). Use when writing or
  reviewing Lambda or package code, running a Lambda locally, adding a hiscores parse order, publishing a package,
  deploying a Lambda, inspecting or changing AWS resources (API Gateway proxy, EventBridge, SQS, Lambda config), or
  committing, pushing, releasing or shipping this repo.
---

# osrs-tracker-aws

Scheduled and SQS-driven Lambdas (`lambda/<function>/`, one npm project each) that keep OSRS Tracker's MongoDB data
fresh, plus the published packages in `@osrs-tracker/`. The consumers are `../osrs-tracker-web` and
`../osrs-tracker-api`, which have their own skills.

**This repo is public.** Never write secret values, account IDs or resource IDs into code, docs or commits, and never
print `.env` values.

Reference, load when needed:

- [INFRA.md](INFRA.md): the AWS resources, Atlas auth and the infra-change procedure.
- [PACKAGES.md](PACKAGES.md): adding a hiscores parse order, versioning and publishing.
- [DEPLOY.md](DEPLOY.md): deploying and rolling back a Lambda.

## Rules

- **Mutating `aws` commands** are production (no IaC, broad default profile): follow [INFRA.md](INFRA.md) and get the
  user's approval of the exact command. Read-only calls are fine.
- **Lambda deploys** go live immediately and **npm publishes** are public and irreversible: get the user's explicit
  go-ahead first.
- **Every write goes through a `DRY_RUN`-aware helper** (`src/utils/dry-run.utils.ts`): Mongo writes in `MU`,
  `sendMessageBatch`, `discordAlert`. Guard new writes with `if (DRY_RUN) return logDryRun(…)`.
- **Only run a handler locally via `npm run invoke:dry`.** There is no staging database.

## Lambda notes

- Create clients at module scope so warm invocations reuse them. `MU.client()` uses SCRAM when `MONGODB_USERNAME` is set
  (local only), otherwise `MONGODB-AWS` from the role.
- Throw to fail a run (SQS retries it); use `discordAlert` for operator-visible failures.
- process-players is the only place that counts 404s: a 404/400 hiscore is skipped and starts a date-based streak; after
  7 days the player's `scrapingOffsets` move to `pausedScrapingOffsets`. The API's `refreshPlayerInfo` restores them.

## Run a Lambda locally

From `lambda/<function>/`, with `.env` filled in: `npm run invoke:dry`. It runs the handler once with `DRY_RUN=true`;
reads and fetches happen, writes are logged as `[DRY_RUN] Would …`. Scheduled Lambdas take an optional event time
(`-- 2026-10-02T18:00:00Z`), process-players takes usernames (`-- Zezima "Lynx Titan"`). It overwrites `dist/` with a
dev build, so run `npm run build` before comparing bundles.

## Verify before handing off

- Each Lambda you touched: `npm run lint && npm run prettier:ci && npm run build`
- `@osrs-tracker/hiscores`: `npx jest && npm run build` (`npm test` is watch mode and never exits)
- `@osrs-tracker/models` or `discord-webhooks`: `npm run build`
- Repo root: `npm run prettier:ci`

CI checks that each package's committed `dist/` matches its build, so commit the rebuilt `dist/`.

## Release ("release it", "ship it")

Run the whole flow without asking between steps; stop only if a step fails. The request is the go-ahead for deploying
and publishing what the change touches, but mutating infra commands still need their own approval. Verify locally once
before committing; after that CI is the gate (builds a deploy or `dist/` needs still run).

1. Commit on a `<type>/<short-name>` branch, push, `gh pr create --base main`.
2. Review `gh pr diff` for bugs and leftovers; fix and push.
3. Once CI passes, deploy the changed Lambdas ([DEPLOY.md](DEPLOY.md)) and publish the changed packages
   ([PACKAGES.md](PACKAGES.md)), and check they work.
4. Commit any version or lockfile bumps to the branch, push, and record what shipped and the check results in the PR
   description.
5. Once the checks pass, `gh pr merge <n> --merge`, then switch to `main`, pull, `git branch -d <branch>`,
   `git fetch --prune`.

## Commit and push

- Doc-only changes (skills, docs) go straight to `main`. Otherwise, outside a release, **ask every time** whether to
  commit to `main` or open a PR. The admin account bypasses `main`'s PR rule; after a direct push, watch CI with
  `gh run watch --exit-status`. After a PR merges, do the switch-back from release step 5.
- A deploy or publish from a PR branch ships unmerged code: tell the user, and don't deploy from `main` until it's
  merged.
- Conventional commits. Scopes: `hiscores`/`models`/…, `lambda` or `osrs-tracker_<function>`, `ci(actions)`,
  `docs(skill)`. Commit and push in the same session as any deploy or publish.
- **Every change gets a changelog entry**: Lambda, infra and CI changes in the root `CHANGELOG.md` under a
  `## YYYY/MM/DD` heading (newest first); package changes in that package's `CHANGELOG.md` (see PACKAGES.md). Busy days
  get `###` subtitles (by area, "Behind the scenes" last); extend an existing entry rather than add a near-duplicate,
  and don't repeat the subtitle in its entries.
- If GPG signing fails with "Inappropriate ioctl for device", ask the user to run
  `echo test | gpg --clearsign > /dev/null` in their terminal. Never use `--no-gpg-sign`.
- `gh pr edit` can fail on a Projects (classic) error; use
  `gh api -X PATCH repos/osrs-tracker/osrs-tracker-aws/pulls/<n> -F body=@<file>`.
