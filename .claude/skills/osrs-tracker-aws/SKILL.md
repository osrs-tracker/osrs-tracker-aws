---
name: osrs-tracker-aws
description:
  Rules and workflow for osrs-tracker-aws (AWS Lambdas and the `@osrs-tracker/*` npm packages). Use when writing or
  reviewing Lambda or package code, running a Lambda locally, adding a hiscores parse order, publishing a package,
  deploying a Lambda, inspecting or changing AWS resources (API Gateway proxy, EventBridge, SQS, Lambda config), or
  committing and pushing this repo.
---

# osrs-tracker-aws

Scheduled and SQS-driven Lambdas (`lambda/<function>/`, one npm project each) that keep OSRS Tracker's MongoDB data
fresh, plus the published packages in `@osrs-tracker/`. The consumers are `../osrs-tracker-web` and
`../osrs-tracker-api`. Those repos have their own skills; when a separate session owns one, send changes there instead
of editing it from here.

**This repo is public.** Never write secret values, account IDs or resource IDs into code, docs or commits. Env var
names are in each Lambda's `.env.example`; the gitignored `.env` holds the values and is never printed or committed.

Reference, load when needed:

- [INFRA.md](INFRA.md): the API Gateway proxy, EventBridge, SQS, Atlas auth and the infra-change procedure.
- [PACKAGES.md](PACKAGES.md): adding a hiscores parse order, versioning, publish order and npm 2FA.
- [DEPLOY.md](DEPLOY.md): deploying and rolling back a Lambda.

## Rules

- **Infra changes** (Lambda config or env, API Gateway, EventBridge, SQS, IAM): record the before state, show the user
  the exact CLI command, wait for their approval, re-read afterwards, log it in the root `CHANGELOG.md`. Read-only
  `get-*`/`list-*`/`describe-*` calls are fine. There is no IaC and the default CLI profile has broad access, so treat
  every mutating `aws` command as production. Details in [INFRA.md](INFRA.md).
- **Deploys** go live on `$LATEST` immediately (no staging, no alias): get the user's explicit go-ahead first.
- **npm publishes** are public and irreversible: get the user's explicit go-ahead first.
- **Every write goes through a `DRY_RUN`-aware helper** (`src/utils/dry-run.utils.ts`): Mongo writes and index creation
  in `MU`, `sendMessageBatch` for SQS, and `discordAlert`. When adding a write, guard it with
  `if (DRY_RUN) return logDryRun(…)`.
- **Never run a handler locally except via `npm run invoke:dry`.** There is no staging database.

## Lambda notes

- Create clients at module scope so warm invocations reuse them. Use `MU.client()`: SCRAM when `MONGODB_USERNAME` is set
  (local only), otherwise `MONGODB-AWS` from the role. Neither `DRY_RUN` nor `MONGODB_USERNAME` is set in production.
- Throw to mark a run as failed (SQS retries it); use `discordAlert` for operator-visible failures.
- process-players' contract with the API: a 404/400 hiscore is skipped (not retried) and starts a date-based streak;
  after 7 days the player's `scrapingOffsets` move to `pausedScrapingOffsets`. The API's `refreshPlayerInfo` restores
  them. Only this Lambda counts 404s.
- Runtime is Node 24 (`npm run update:runtime`, `engines.node >=24`).

## Run a Lambda locally

From `lambda/<function>/`, with `.env` filled in (an Atlas database user in `MONGODB_USERNAME`/`MONGODB_PASSWORD`):

```bash
npm run invoke:dry
```

It makes a dev build and runs the handler once with `DRY_RUN=true`: reads and external fetches happen, every write is
logged as `[DRY_RUN] Would …`. Scheduled Lambdas take an optional event time
(`npm run invoke:dry -- 2026-10-02T18:00:00Z`); process-players takes usernames
(`npm run invoke:dry -- Zezima "Lynx Titan"`). The dev build overwrites `dist/`, so run `npm run build` again before
comparing bundles.

## Verify before handing off

- Each Lambda you touched, inside its directory: `npm run lint && npm run prettier:ci && npm run build`
- `@osrs-tracker/hiscores`: `npx jest && npm run build` (`npm test` is `jest --watch` and never exits)
- `@osrs-tracker/models` or `discord-webhooks`: `npm run build`
- Repo root: `npm run prettier:ci`

CI checks that each package's committed `dist/` matches its build, so commit the rebuilt `dist/` with any package source
change. After pushing, check the run with `gh run watch --exit-status`.

## Commit and push

- **Ask the user whether to commit straight to `main` or open a PR**, every time, before committing. `main` requires a
  PR and the passing `CI` check (no approvals), which the user's admin account can bypass, so a direct push works and
  shows a "bypassed rule violations" notice.
  - Straight to `main`: push, then watch the CI run (`gh run watch --exit-status`).
  - PR: commit on a `<type>/<short-name>` branch, push it, `gh pr create --base main` and check `gh pr checks`. Once the
    user says it's merged, `git switch main && git pull --ff-only`, delete the local branch with `git branch -d` and
    `git fetch --prune` (GitHub deletes the remote branch on merge).
  - Deploying or publishing from a PR branch leaves production running unmerged code: tell the user, and don't deploy
    from `main` until the PR is merged.
- Conventional commits. Scopes: `@osrs-tracker/<package>` (or `hiscores`), `lambda` or `osrs-tracker_<function>`,
  `ci(actions)`, `docs(skill)`.
- **Every change gets a changelog entry in the same commit**: Lambda, infra and CI changes under a `## YYYY/MM/DD`
  heading in the root `CHANGELOG.md` (newest first, reuse today's heading); package changes in that package's
  `CHANGELOG.md` with its versioned heading.
- Commits are GPG-signed. If signing fails with "Inappropriate ioctl for device", ask the user to unlock the key with
  `echo test | gpg --clearsign > /dev/null`; never use `--no-gpg-sign`.
- Push via `gh`. Commit and push in the same session as any deploy or publish, so production never runs code that isn't
  on GitHub.
