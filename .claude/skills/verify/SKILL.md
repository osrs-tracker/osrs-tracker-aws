---
name: verify
description:
  Runs osrs-tracker-aws's verify checks (prettier, lint, type check, build, tests) for the Lambdas and packages a change
  touches and reports each one's result. Use right before a commit, and whenever asked to verify the repo.
---

# verify

Run from the checkout's root (the worktree, not the main checkout).

## Pick what to check

List the changed files: `git diff --cached --name-only` before a commit (add `git diff --name-only` for unstaged work
when asked to verify without a commit). Then check:

- every `lambda/<function>/` with a changed file; a change in `lambda/shared/` touches all four Lambdas;
- every `@osrs-tracker/<package>/` with a changed file;
- always the repo root.

A worktree has no `node_modules` of its own: run `npm ci` first in each folder below that lacks one.

## Run every check, even after a failure

Run each check below as its own command, cheapest first, and **keep going when one fails**: don't chain them with `&&`
or stop at the first failure. Collect every failure, then fix them all in one round and rerun.

1. Repo root: `npm run prettier:ci`
2. Each touched Lambda, from its folder:
   1. `npm run prettier:ci`
   2. `npm run lint`
   3. `npx tsc --noEmit -p .` (the esbuild build doesn't type-check; this also checks the shared files it imports)
   4. `npm run build`
3. Each touched package, from its folder (its `npm run build` is `tsc`, so it type-checks):
   - `hiscores`: `npm run build`, then `npx jest`
   - `express-metrics`, `logger`: `npm run build`, then `npx vitest run`
   - `models`: `npm run build`, `npx tsc -p tsconfig.spec.json`, then `npx vitest run` (its integration tests start an
     in-memory MongoDB 8.0)

Never run `npm test`: it's watch mode in every package.

## Report

One line per check: folder, command, passed or failed, with the relevant output for each failure. `npm run prettier` and
`npm run lint -- --fix` fix what they can; fix the rest by hand and rerun the failed checks. Don't commit while a check
fails.
