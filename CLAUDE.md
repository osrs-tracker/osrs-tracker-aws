# osrs-tracker-aws

Four AWS Lambdas (`lambda/<function>/`, Node 24, one npm project each) that keep OSRS Tracker's MongoDB Atlas data
fresh, plus the npm packages in `@osrs-tracker/` (`models`, `hiscores`, `express-metrics`). Sibling repos:
`../osrs-tracker-api` (writes the same collections) and `../osrs-tracker-web`. **This repo is public.**

**Load the `osrs-tracker-aws` skill before writing, reviewing, running, deploying, publishing or committing anything
here.** It holds the `DRY_RUN`, Lambda, changelog and release rules, with infra, deploy and package steps in its
`INFRA.md`, `DEPLOY.md` and `PACKAGES.md`. Keep detail there, not in this file.

## Commands

- Verify a Lambda (from its folder): `npm run lint && npm run prettier:ci && npx tsc --noEmit -p . && npm run build`.
- Verify a package: `hiscores` `npx jest && npm run build`, `express-metrics` `npx vitest run && npm run build`
  (`npm test` is watch mode in both); `models` `npm run build`. Repo root: `npm run prettier:ci`.
- Run a Lambda locally: `npm run invoke:dry` (needs `.env` from `.env.example`). Reads and fetches are real; writes are
  only logged. There is no staging database.
- Size per dependency in a bundle:
  `npx esbuild src/index.ts --bundle --platform=node --minify --metafile=<tmp>/meta.json --outfile=<tmp>/out.js`, then
  group `outputs[*].inputs` by `node_modules/<pkg>`.
- Worktrees in `.claude/worktrees/` find only the root `node_modules` in the main checkout. Run `npm ci` in each Lambda
  or package folder you build, lint or test. The pre-push hook lints every Lambda, so all four need it before a push.

## Hard rules

- Never write secrets, account IDs or resource IDs into code, docs, issues or commits, and never print `.env` or Lambda
  env values.
- Every write goes through a `DRY_RUN`-aware helper (Mongo in `MU`, `sendMessageBatch`, `discordAlert`).
- Lambda deploys go live immediately and npm publishes are irreversible: get an explicit go-ahead (a "release it"
  counts). Mutating `aws` commands follow `INFRA.md`: show the exact command and wait for approval.
- process-players must not throw after its bulk writes: SQS would retry the message and store duplicate hiscore entries.
- A change to a shared field or index updates `DATA-MODEL.md` in the same change, plus an issue in osrs-tracker-api when
  it has to follow.
- Every change gets a changelog entry: Lambdas, infra and CI in the root `CHANGELOG.md` under today's `## YYYY/MM/DD`,
  packages in their own `CHANGELOG.md`.
- Doc-only changes go straight to `main`; for anything else, ask: `main` or a PR (unless releasing). Never
  `--no-gpg-sign`.

## Where things live

- `lambda/<function>/`: `src/index.ts` (handler, clients at module scope), `src/env.ts` (its env schema), `src/utils/`
  (`mongo.utils.ts` = `MU` with its own queries, Lambda-specific helpers), `build/invoke.js` (its `invoke:dry` event),
  and a `README.md` with the trigger and env var names (update it when either changes). Lambda `dist/` is not committed.
- `lambda/shared/`: code every Lambda bundles, no `package.json` (imports resolve from the Lambda's `node_modules`):
  `src/` (`env.ts`, `dry-run.utils.ts`, `mongo.utils.ts`, `sqs.utils.ts`, `discord-alert.ts`), `build/esbuild.js`,
  `build/invoke.js` and `eslint.config.mjs`. A change there touches all four Lambdas.
- `@osrs-tracker/<package>/`: `dist/` is built on publish (`prepublishOnly`) and not committed; `files` limits the
  tarball to `dist/`, `CHANGELOG.md` and `NOTICE`. The repo is Apache-2.0: each package keeps a copy of the root
  `LICENSE` and `NOTICE`. `models`, `hiscores` and `express-metrics` ship `dist/cjs`, `dist/esm` and `dist/types`:
  osrs-tracker-api `require`s the CJS build and osrs-tracker-web bundles the ESM one, so a build change must keep both
  loading.
- `DATA-MODEL.md`: who writes each `players`/`items` field and owns each index, and the pause/resume contract.
- `.github/workflows/main.yml`: CI checks only the folders a push changed; its `CI` job is the one required check.
  `.github/actions/setup-deps` caches each folder's `node_modules` by its lockfile.
- `.claude/agents/conventions-reviewer.md` reviews diffs against the skill and this file. `.claude/settings.json` runs
  Prettier on every file Claude edits and blocks `git push` when Prettier or a Lambda's lint fails.
- AWS (eu-central-1, console-managed, no IaC): Lambda logs are kept 7 days, so a longer Logs Insights range silently
  returns only 7.
