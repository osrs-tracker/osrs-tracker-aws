---
name: verify
description:
  Runs osrs-tracker-aws's verify checks (prettier, lint, type check, build, tests) for the Lambdas and packages a change
  touches and reports each one's result. Use right before a commit, and whenever asked to verify the repo.
---

# verify

Run the script from the checkout's root (the worktree, not the main checkout), in one Bash call:

```bash
.claude/skills/verify/verify.sh
```

Before a commit it checks what the staged files touch (`git diff --cached --name-only`). To verify without a commit, add
`--all-changes`, which adds unstaged changes (`git diff --name-only`). It checks:

- every `lambda/<function>/` with a changed file; a change in `lambda/shared/` touches every Lambda;
- every `@osrs-tracker/<package>/` with a changed file;
- always the repo root.

A worktree has no `node_modules` of its own: the script first runs `npm ci`, one folder at a time, in each selected
folder that lacks one.

It then runs every check at once (about 8 s instead of 17 s one after another for a `lambda/shared/` and `models`
change), never stopping at a failure:

1. Repo root: `npm run prettier:ci`
2. Each touched Lambda, from its folder, each as its own check:
   1. `npm run prettier:ci`
   2. `npm run lint`
   3. `npx tsc --noEmit -p .` (the esbuild build doesn't type-check; this also checks the shared files it imports)
   4. `npm run build`
   5. `npx vitest run`, for a Lambda with a `vitest.config.ts` (clean-hiscores, process-players and queue-players;
      process-players' also runs `lambda/shared`'s specs)
3. Each touched package, from its folder, as one check in this order (its `npm run build` is `tsc`, so it type-checks):
   - `hiscores`: `npm run build`, then `npx jest`
   - `express-metrics`, `logger`: `npm run build`, then `npx vitest run`
   - `models`: `npm run build`, `npx tsc -p tsconfig.spec.json`, then `npx vitest run` (its integration tests start an
     in-memory MongoDB 8.0)

Never run `npm test`: it's watch mode in every package and Lambda that has it.

It prints each failed check's log (the last 60 lines of a long one, with the full log's path), then a `passed`/`FAILED`
line per check with its folder, command and seconds, and exits 1 when any failed.

## Report

One line per check: folder, command, passed or failed, quoting the relevant errors for each failure. Never claim a pass
without the script's output. Fix every failure in one round, then run the script again: `npm run prettier` and
`npm run lint -- --fix` fix what they can; fix the rest by hand. Don't commit while a check fails, and don't drop a
check to save time: the push gate covers only lint and Prettier.
