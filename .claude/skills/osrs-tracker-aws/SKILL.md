---
name: osrs-tracker-aws
description:
  Layout, console-managed AWS infra, Lambda and npm package conventions, verification and the deploy/publish workflow
  for osrs-tracker-aws. Use when writing or reviewing Lambda or `@osrs-tracker/*` package code, adding a hiscores parse
  order for a Jagex hiscore change, publishing a package, deploying a Lambda, inspecting or changing AWS resources (API
  Gateway proxy, EventBridge, SQS, Lambda config), or committing or pushing this repo.
---

# osrs-tracker-aws

Scheduled and queue-driven AWS Lambdas that keep OSRS Tracker's MongoDB data fresh, plus the shared npm packages
`@osrs-tracker/models`, `@osrs-tracker/hiscores` and `@osrs-tracker/discord-webhooks`. The consumers are the sibling
repos `../osrs-tracker-web` (Angular SSR) and `../osrs-tracker-api` (NestJS). Each has its own skill and its own agent:
"OSRS Tracker Web" orchestrates and "OSRS Tracker API" owns the API. Changes in those repos go through their agents, not
this one.

## Layout

- `lambda/<function>/`: one independent npm project per Lambda (own `package.json`, lockfile, `node_modules`,
  `.prettierrc.json`, `eslint.config.mjs`). `src/index.ts` exports `handler`; helpers live in `src/utils/`
  (`mongo.utils.ts` exposes the `MU` class, plus `discord-alert.ts` and `sqs.utils.ts`). `build/esbuild.js` bundles
  everything into `dist/index.js`. `lambda/tsconfig.lambda.json` is the shared base tsconfig.
- `@osrs-tracker/<package>/`: published npm packages with committed `dist/` and their own `CHANGELOG.md`.
- Root: prettier and commitizen only, plus `CHANGELOG.md` for Lambda, infra and CI changes. CI is
  `.github/workflows/main.yml`.

### Lambdas

All run in eu-central-1, arm64, 128 MB, with IAM role `AWS_Lambda`. Env var names below; never copy values into code,
commits or messages.

| Function                       | Trigger                                                   | Env vars                                                                                    |
| ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `osrs-tracker_refresh-items`   | EventBridge `Hourly` (`cron(0 * * * ? *)`)                | `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_COLLECTION`                                     |
| `osrs-tracker_queue-players`   | EventBridge `Hourly`                                      | `MONGODB_*`, `SQS_QUEUE_URL`, `PLAYERS_PER_SQS_MESSAGE`, `OSRS_API_BASE_URL`                |
| `osrs-tracker_process-players` | SQS `osrs-tracker_players-to-scrape` (batch 1), 300 s max | `MONGODB_*`, `SQS_QUEUE_URL`, `PLAYERS_PER_SQS_MESSAGE`, `OSRS_API_BASE_URL`, `WEBHOOK_URL` |
| `osrs-tracker_clean-hiscores`  | EventBridge `daily` (`cron(0 0 * * ? *)`)                 | `MONGODB_*`, `MAX_AGE_IN_DAYS`, `WEBHOOK_URL`                                               |

- **refresh-items** fetches `prices.runescape.wiki/api/v1/osrs/mapping` (with a descriptive `user-agent`, as the wiki
  requires) and upserts it into the items collection.
- **queue-players** derives the UTC offset (-12…11) from the event time, finds players whose `scrapingOffsets` contain
  it, and sends batches of usernames to SQS.
- **process-players** fetches `${OSRS_API_BASE_URL}/m=hiscore_oldschool/index_lite.json?player=…` with a 2 s stagger per
  username, and `$push`es a `HiscoreEntry` at position 0. It re-queues failed usernames, and throws without re-queuing
  when nobody was updated, to avoid a retry loop. On a redelivery it sends a Discord alert.
- **clean-hiscores** `$pull`s hiscore entries older than `MAX_AGE_IN_DAYS`.

Locally, `lambda/osrs-tracker_process-players/.env` holds these vars plus AWS keys. It is gitignored; never commit it or
print its values.

### Packages and their consumers

- `@osrs-tracker/models` 0.7.1: shared types (`Player`, `HiscoreEntry`, `Item`, …), built as cjs, esm and types.
  - Web `^0.7.1`, API `^0.7.1`, process-players `^0.7.1`.
  - Older versions are still in use: queue-players `^0.6.0`, clean-hiscores `^0.4.0`, refresh-items `^0.3.3`.
- `@osrs-tracker/hiscores` 2.1.3: the hiscore parser, XP levels and diffs. It peer-depends on models `^0.7.1`. Web uses
  `^2.1.3`; no Lambda uses it.
- `@osrs-tracker/discord-webhooks` 0.0.2: `DiscordWebhook.dispatch()` POSTs to `WEBHOOK_URL` with global fetch. Used by
  clean-hiscores, process-players and queue-players.

## Infra (console-managed, no IaC)

AWS account `687910490357`, region `eu-central-1`. There is no CDK, Terraform or SAM. Every resource below was created
in the console, so this repo has no diff to review.

- **API Gateway HTTP API `dcnfyr5gsk` ("OSRS Tracker API")**: custom domain `runescape-api.freekmencke.com`, `$default`
  stage with auto-deploy.
  - It has one route, `ANY /rs/{proxy+}`, an HTTP_PROXY to `https://secure.runescape.com/{proxy}`. The response override
    sets `X-Robots-Tag: noindex` on 200.
  - CORS allows `https://osrs-tracker.freekmencke.com` and `http://localhost:4200`.
  - Jagex's `Cache-Control: no-cache` passes through. That's acceptable, because the web app only calls this from the
    browser.
  - There are three consumers, all GET-only:
    - the web app, in the browser, for live hiscores;
    - osrs-tracker-api, server-side, for the news RSS and hiscores (`OSRS_API_BASE_URL=…/rs`);
    - process-players.
  - **Any change to the route, headers or CORS affects all three**, so get a check from the Web and API agents too.
- **EventBridge rules**: `Hourly`, `daily`, `bihourly` and `four-hourly`.
- **SQS**: `osrs-tracker_players-to-scrape` (redrive to `osrs-tracker_players-to-scrape-dead` after 3 receives) and the
  DLQ `osrs-tracker_players-to-scrape-dead`.
- **MongoDB Atlas** (not AWS): cluster `shared-cluster.tf5uvgy.mongodb.net`, database `osrs-tracker` (`players` and
  items collections).
  - Lambdas authenticate with `MONGODB-AWS` (the role's credentials, `authSource: '$external'`).
  - The API uses the same database, but with SCRAM username/password: its k8s secret `aws-mongodb-credentials` holds an
    Atlas database user despite the name, not IAM keys.
  - So rotating the Lambda IAM credentials doesn't affect the API, and vice versa.
- The account also holds unrelated resources (Nordigen proxy `9xk60y8pwf`, `fremen-server_dns-update`,
  `robots-txt_disallow-scraping`). Leave them alone.

**Rules for any infra change** (API GW, EventBridge, SQS, Lambda configuration or env vars, IAM):

1. Read-only `get-*`, `list-*` and `describe-*` calls are fine to run.
2. Record the before state first, e.g. `aws apigatewayv2 get-integration --api-id dcnfyr5gsk --integration-id <id>` or
   `aws lambda get-function-configuration --function-name <fn>`. Keep it in your reply, so the change can be rolled
   back.
3. Show the user the **exact AWS CLI command** to run, and wait for their explicit approval before running it.
4. Afterwards, re-read the resource to confirm the change, and log it in the root `CHANGELOG.md`.

## Lambda conventions

Match the surrounding code:

- TypeScript bundled by esbuild into a single minified `dist/index.js` (`platform: 'node'`), with a sourcemap in dev.
  `tsconfig.json` extends `../tsconfig.lambda.json` (es2022, strict, `noUnusedLocals`).
- Create clients (`MongoClient`, `SQSClient`, the https keep-alive `Agent`) at module scope, so warm invocations reuse
  them.
- Use the `MU` helpers for Mongo access, with `hint` for indexed queries and `projection` to exclude `_id`. Ensure
  indexes with `createIndex` at the start of the handler.
- Return `context.logStreamName`. Throw to mark a run as failed (SQS will then retry). Use `discordAlert` for
  operator-visible failures.
- Prettier and eslint are configured per project. Run them inside the Lambda's directory.
- **Target runtime is Node 24 (`nodejs24.x`).** Production is still `nodejs22.x` and `update:runtime` scripts still say
  `nodejs22.x` until they're migrated. Don't use APIs newer than Node 22 before that migration.

## Package conventions

- **Jagex hiscore change** (new skill, boss or activity): add `src/parser/parse-order/<year>/po-YYYY-MM-DD.ts`
  (`PO_YYYY_MM_DD: ParseOrder`, with a doc comment naming the change). Copy the previous order and insert the new
  `SkillEnum`/`ActivityEnum` entry at the position Jagex uses.
  - Register it in that year's `index.ts` map under the key `'YYYY-MM-DDT11'` (the release hour, UTC). For a new year,
    add a `<year>/index.ts` and spread it into `ParseOrderMap` in `parse-order.ts`.
  - Add any new enum members to `models/hiscore.enum.ts`.
  - Add a `po-YYYY-MM-DD.spec.ts` that parses a real hiscore string dated on the release day and asserts the new and
    neighbouring entries.
- **Publish order**: `models` first, then `hiscores` (bump its `peerDependencies` and `devDependencies` on models), then
  the consumers.
- Run tests with `npx jest` in `@osrs-tracker/hiscores`. `npm test` is `jest --watch` and never exits.
- Bump the version in `package.json`, add a `## vX.Y.Z - YYYY/MM/DD` entry to the package's `CHANGELOG.md` (models uses
  `## X.Y.Z - YYYY/MM/DD`), build, and commit `dist/` too.
- Publishing: `npm publish` inside the package directory (`prepublishOnly` rebuilds). It is public and irreversible, so
  get the user's go-ahead first.
- After publishing:
  - Bump the Lambdas here yourself.
  - Ask "OSRS Tracker Web" to bump the web app, and "OSRS Tracker API" to bump the API. Don't edit those repos from
    here.

## Verify before handing off

For each Lambda you touched, inside `lambda/<function>/`:

```bash
npm run lint && npm run prettier:ci && npm run build
```

For `@osrs-tracker/hiscores`:

```bash
npx jest && npm run build
```

For `@osrs-tracker/models` or `discord-webhooks`:

```bash
npm run build
```

From the repo root:

```bash
npm run prettier:ci
```

CI (`.github/workflows/main.yml`) runs root prettier, then lint, prettier and build for each of the 4 Lambdas on every
push to `main`. It does **not** build or test the packages, so run those checks yourself.

## Deploy a Lambda

`npm run deploy` builds, zips and calls `aws lambda update-function-code … --publish` with the default AWS CLI profile.
**The code goes live immediately on `$LATEST`** (triggers don't use aliases), so get the user's explicit go-ahead first.

1. Pass the verification steps above, and check the bundle in `dist/index.js`.
2. Record the before state:

   ```bash
   aws lambda get-function-configuration --function-name <fn> --query '{sha:CodeSha256,version:Version,modified:LastModified,runtime:Runtime}'
   ```

3. Deploy from `lambda/<fn>/`:

   ```bash
   npm run deploy
   ```

4. Confirm that `CodeSha256` changed (same command as step 2), and note the new published version number from the deploy
   output.
5. Watch the next scheduled or SQS-triggered run, and check that it logs its normal summary without errors:

   ```bash
   aws logs tail /aws/lambda/<fn> --since 10m --follow
   ```

6. Rollback: redeploy the previous commit's code with `git checkout <prev> -- lambda/<fn>/src` and `npm run deploy`,
   then restore the files. Or download the previous published version with
   `aws lambda get-function --function-name <fn> --qualifier <version>` and upload its zip.

## Known issues (durable)

- No IaC: infra is changed only by hand with approved CLI commands, so record the before state every time.
- Lambda deploys go live on `$LATEST` immediately, with no staging and no alias.
- CI doesn't cover the `@osrs-tracker/*` packages.
- The default AWS CLI credentials have broad account access. Treat every mutating `aws` command as production.

## Commit and push

- Commit straight to `main` with conventional commits (commitizen is configured). Scopes in use:
  - `hiscores` / `@osrs-tracker/hiscores`, `@osrs-tracker/models` and `@osrs-tracker/discord-webhooks`;
  - `lambda`, or `osrs-tracker_<function>` for a single function;
  - `ci(actions)`, `docs(skill)`.
- **Every change gets a changelog entry** in the same commit.
  - Lambda, infra and CI changes go in the root `CHANGELOG.md`: a `## YYYY/MM/DD` heading (newest first; add to today's
    heading if it exists) with short bullets.
  - Package changes go in that package's `CHANGELOG.md`, using its versioned heading.
- Commits are GPG-signed. If signing fails with "Inappropriate ioctl for device", ask the user to unlock the key in
  their own terminal (`echo test | gpg --clearsign > /dev/null`); never use `--no-gpg-sign`.
- Push over HTTPS via `gh` (`gh auth setup-git` is configured). If `gh auth status` fails, ask the user to log in.
- Deploying or publishing without committing leaves production running code that isn't on GitHub, so commit and push in
  the same session.
