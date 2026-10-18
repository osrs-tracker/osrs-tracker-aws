# osrs-tracker-aws

Six AWS Lambdas (`lambda/<function>/`, Node 24, one npm workspace in `lambda/`): five keep OSRS Tracker's MongoDB Atlas
data fresh, alarm-to-discord posts the CloudWatch alarms to Discord. Plus the npm packages in `@osrs-tracker/`
(`models`, `hiscores`, `express-metrics`, `logger`). Sibling repos: `../osrs-tracker-api` (writes the same collections)
and `../osrs-tracker-web`. **This repo is public.**

**Load the `osrs-tracker-aws` skill before writing, reviewing, running, deploying, publishing or committing anything
here.** It holds the `DRY_RUN`, Lambda, changelog and release rules, with infra, deploy and package steps in its
`INFRA.md`, `DEPLOY.md` and `PACKAGES.md`. Keep detail there, not in this file.

## Commands

- Verify a Lambda (from its folder): `npm run lint && npm run prettier:ci && npx tsc --noEmit -p . && npm run build`,
  plus `npx vitest run` where it has a `vitest.config.mts` (`npm test` is watch mode).
- Verify a package: `express-metrics` and `logger` `npm run lint && npx vitest run && npm run build` (`npm test` is
  watch mode in all of them); `hiscores` and `models`
  `npm run lint && npx vitest run && npx tsc -p tsconfig.spec.json && npm run build` (models' integration tests start an
  in-memory MongoDB 8.0). Repo root: `npm run prettier:ci`. The `verify` skill's `.claude/skills/verify/verify.sh` picks
  the folders a staged change touches (`--all-changes` adds unstaged ones) and runs all of these checks at once, in one
  call; Claude Code runs it before each commit.
- Run a Lambda locally: `npm run invoke:dry` (needs `.env` from `.env.example`). Reads and fetches are real; writes are
  only logged. There is no staging database.
- Size per dependency in a bundle:
  `npx esbuild src/index.ts --bundle --platform=node --minify --metafile=<tmp>/meta.json --outfile=<tmp>/out.js`, then
  group `outputs[*].inputs` by `node_modules/<pkg>`.
- Worktrees in `.claude/worktrees/` find only the root `node_modules` in the main checkout. Run `npm ci` in `lambda/`
  (all six Lambdas) and in each package folder you build, lint or test. The pre-push hook lints every Lambda, so
  `lambda/` needs it before a push. `.worktreeinclude` copies each Lambda's `.env` into a new worktree, so `invoke:dry`
  works there.

## Hard rules

- Never write secrets, account IDs or resource IDs into code, docs, issues or commits, and never print `.env` or Lambda
  env values.
- Every write goes through a `DRY_RUN`-aware helper (Mongo in `MU`, `sendMessageBatch`, `discordAlert`).
- Lambda deploys go live immediately and npm publishes are irreversible: get an explicit go-ahead (a "release it"
  counts). Mutating `aws` commands follow `INFRA.md`: show the exact command and wait for approval.
- process-players must not throw after its bulk writes: SQS would retry the message and store duplicate hiscore entries.
- A change to a shared field or index updates `DATA-MODEL.md` in the same change, plus an issue in osrs-tracker-api when
  it has to follow.
- Every change except a doc-only one gets a changelog entry: Lambdas, infra, CI and tooling (`.claude/hooks/`,
  `.claude/settings.json`) in the root `CHANGELOG.md` under today's `## YYYY-MM-DD`, packages in their own
  `CHANGELOG.md`. Doc-only means `docs/`, `README.md` files (also a Lambda's or package's), `CLAUDE.md`,
  `.claude/skills/`, `.claude/agents/`, and `DATA-MODEL.md` edits that only document (one that comes with a data change
  is logged with it). A dependency bump gets an entry only when it changes behaviour (a new feature used, a fix that
  matters, a breaking change handled).
- Doc-only changes go straight to `main`; for anything else, ask: `main` or a PR (unless releasing). Never
  `--no-gpg-sign`.

## Where things live

- `lambda/<function>/`: `src/index.ts` (handler, clients at module scope), `src/env.ts` (its env schema), `src/utils/`
  (`mongo.utils.ts` = `MU` with its own queries, Lambda-specific helpers), `build/invoke.js` (its `invoke:dry` event),
  and a `README.md` with the trigger and env var names (update it when either changes). Lambda `dist/` is not committed.
- `lambda/package.json`: the workspace root (the Lambdas and `shared`) with every Lambda's devDependencies, and the one
  `lambda/package-lock.json`. Each Lambda's `package.json` holds its runtime dependencies and scripts.
- `lambda/shared/`: code every Lambda bundles, the workspace package `@lambda/shared`: `src/` (`env.ts`,
  `dry-run.utils.ts`, `mongo.utils.ts`, `sqs.utils.ts`, `discord-alert.ts`, `commit.ts`, `user-agent.ts` (the
  `User-Agent` every outgoing request sends); its `*.spec.ts` run from process-players' `vitest.config.mts`),
  `build/esbuild.js`, `build/invoke.js` and `.oxlintrc.json` (every Lambda's and package's `lint` passes it with `-c`;
  oxlint until typescript-eslint supports TypeScript 7, #143). A change there touches all six Lambdas.
- `@osrs-tracker/<package>/`: `dist/` is built on publish (`prepublishOnly`) and not committed; `files` limits the
  tarball to `dist/`, `CHANGELOG.md` and `NOTICE`. The repo is Apache-2.0: each package keeps a copy of the root
  `LICENSE` and `NOTICE`. `models`, `hiscores`, `express-metrics` and `logger` ship `dist/cjs`, `dist/esm` and
  `dist/types`: osrs-tracker-api `require`s the CJS build and osrs-tracker-web bundles the ESM one, so a build change
  must keep both loading.
- `DATA-MODEL.md`: who writes each `players`/`items`/`hiscoreLayouts` field and owns each index, the stored hiscore
  format, and the pause/resume contract.
- `.github/workflows/main.yml`: CI checks only the folders a push changed; its `CI` job is a required check, with
  `zizmor.yml`'s `zizmor` (audits the workflows; `.github/zizmor.yml` says what it allows). `.github/actions/setup-deps`
  caches each npm project's `node_modules` (the repo root, `lambda/`, each package) by its lockfile.
- `.claude/agents/conventions-reviewer.md` reviews diffs against the skill and this file;
  `.claude/hooks/read-only-bash.sh` keeps it to git, gh and grep reads. `.claude/settings.json` runs Prettier on every
  file Claude edits, and `.claude/hooks/pre-push-check.sh` blocks `git push` (also `git -C <path> push`) when Prettier
  or a Lambda's lint fails in the checkout being pushed.
- AWS (eu-central-1, console-managed, no IaC): Lambda logs are kept 7 days, so a longer Logs Insights range silently
  returns only 7. `infra/snapshot.sh` writes the live settings (names and values, no IDs) to `infra/aws-settings.json`
  with read-only calls (AWS CLI and jq); rerun it after every infra change and commit the diff. Prettier ignores the
  JSON: the script writes it.
