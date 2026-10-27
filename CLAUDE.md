# osrs-tracker-aws

Four AWS Lambdas (`lambda/<function>/`, Node 24, one npm workspace at the repo root): queue-players, process-players and
record-player-count scrape OSRS Tracker's player data into a queue, alarm-to-discord posts the CloudWatch alarms to
Discord. Sibling repos: `../osrs-tracker-api` (its ingester applies the queue to MongoDB and runs the item and clean-up
jobs), `../osrs-tracker-web` and `../osrs-tracker-packages` (the `@osrs-tracker/*` npm packages the Lambdas install from
npm). **This repo is public.**

**Load the `osrs-tracker-aws` skill before writing, reviewing, running, deploying or committing anything here.** It
holds the `DRY_RUN`, Lambda, changelog and release rules, with infra and deploy steps in its `INFRA.md` and `DEPLOY.md`.
Keep detail there, not in this file.

## Commands

- Verify a Lambda (from its folder): `npm run lint && npx tsc --noEmit -p . && npm run build`, plus `npx vitest run`
  where it has a `vitest.config.mts` (`npm test` is watch mode).
- Repo root: `npm run prettier:ci`, `npm run knip` (unused code, `knip.jsonc`), `npm run jscpd` (copy-pasted code,
  `.jscpd.json`). The `verify` skill's `.claude/skills/verify/verify.sh` picks the folders a staged change touches
  (`--all-changes` adds unstaged ones) and runs all of these checks at once, in one call; Claude Code runs it before
  each commit.
- Run a Lambda locally: `npm run invoke:dry` (needs `.env` from `.env.example`). Reads and fetches are real; writes are
  only logged. There is no staging database.
- Size per dependency in a bundle:
  `npx esbuild src/index.ts --bundle --platform=node --minify --metafile=<tmp>/meta.json --outfile=<tmp>/out.js`, then
  group `outputs[*].inputs` by `node_modules/<pkg>`.
- Worktrees in `.claude/worktrees/` have no `node_modules` and would resolve the main checkout's, whose workspace links
  point at the main checkout's Lambdas: run `npm ci` at the worktree's root first (the pre-push hook lints every
  Lambda). `.worktreeinclude` copies each Lambda's `.env` into a new worktree, so `invoke:dry` works there.

## Hard rules

- Never write secrets, account IDs or resource IDs into code, docs, issues or commits, and never print `.env` or Lambda
  env values.
- Every write goes through a `DRY_RUN`-aware helper (`invokeAsync`, `sendScrapeResult`, `discordAlert`).
- Lambda deploys go live immediately: get an explicit go-ahead (a "release it" counts). Mutating `aws` commands follow
  `INFRA.md`: show the exact command and wait for approval.
- The data model lives in osrs-tracker-api's `DATA-MODEL.md`: a change to a scrape result message or to how
  queue-players reads the subscriptions table needs an issue there.
- Every change except a doc-only one gets a changelog entry: Lambdas, infra, CI and tooling (`.claude/hooks/`,
  `.claude/settings.json`, scripts such as `.claude/skills/verify/verify.sh`) in the root `CHANGELOG.md` under today's
  `## YYYY-MM-DD`. Doc-only means `README.md` files (also a Lambda's), `CLAUDE.md`, the Markdown files in
  `.claude/skills/` and `.claude/agents/`, and `DATA-MODEL.md`. A dependency bump gets an entry only when it changes
  behaviour (a new feature used, a fix that matters, a breaking change handled).
- Doc-only changes go straight to `main`; for anything else, ask: `main` or a PR (unless releasing). Never
  `--no-gpg-sign`.

## Where things live

- `lambda/<function>/`: `src/index.ts` (handler, clients at module scope), `src/env.ts` (its env schema), `src/utils/`
  (Lambda-specific helpers), `build/invoke.js` (its `invoke:dry` event), and a `README.md` with the trigger and env var
  names (update it when either changes). Lambda `dist/` is not committed.
- `package.json`: the workspace root (the Lambdas and `lambda/shared`) with every devDependency, the root Prettier
  scripts, and the one `package-lock.json`. Each Lambda's `package.json` holds its runtime dependencies and scripts.
- `lambda/shared/`: code every Lambda bundles, the workspace package `@lambda/shared`: `src/` (`env.ts`,
  `dry-run.utils.ts`, `lambda.utils.ts`, `sqs.utils.ts`, `discord-alert.ts`, `commit.ts`, `user-agent.ts` (the
  `User-Agent` every outgoing request sends); its `*.spec.ts` run from process-players' `vitest.config.mts`),
  `build/esbuild.js`, `build/invoke.js` and `.oxlintrc.json` (every Lambda's `lint` passes it with `-c`; oxlint, not
  ESLint, while the repo is on TypeScript 7, which typescript-eslint doesn't support as of 2026-10-18). A change there
  touches all four Lambdas.
- `DATA-MODEL.md`: a pointer to osrs-tracker-api's copy (osrs-tracker/osrs-tracker-api#205).
- `.github/workflows/main.yml`: on pushes to `main` and on PRs, CI checks only the Lambda folders changed (all of them
  when `.github/`, `lambda/shared/`, `lambda/tsconfig.lambda.json`, `package.json` or `package-lock.json` changes), and
  always runs the root checks (Prettier, knip, jscpd) and the Markdown link check (lychee); its `CI` job is a required
  check, with `zizmor.yml`'s `zizmor` (audits the workflows; `.github/zizmor.yml` says what it allows).
  `.github/actions/setup-deps` caches the workspace's `node_modules` (the root's, plus any a Lambda gets of its own) by
  the root `package-lock.json`.
- `.claude/agents/conventions-reviewer.md` reviews diffs against the skill and this file;
  `.claude/hooks/read-only-bash.sh` keeps it to git, gh and grep reads. `.claude/settings.json` runs Prettier on every
  file Claude edits, and `.claude/hooks/pre-push-check.sh` blocks `git push` (also `git -C <path> push`) when Prettier
  or a Lambda's lint fails in the checkout being pushed.
- AWS (eu-central-1, console-managed, no IaC): Lambda logs are kept 7 days, so a longer Logs Insights range silently
  returns only 7. `infra/snapshot.sh` writes the live settings (names and values, no IDs) to `infra/aws-settings.json`
  with read-only calls (AWS CLI and jq); rerun it after every infra change and commit the diff. Prettier ignores the
  JSON: the script writes it.
