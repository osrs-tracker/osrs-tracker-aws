---
name: verify
description:
  Runs osrs-tracker-aws's verify checks (prettier, lint, type check, build, tests) for the Lambdas a change touches and
  reports each one's result. Use right before a commit, and whenever asked to verify the repo.
---

# verify

Run the script from the checkout's root (the worktree, not the main checkout), in one Bash call:

```bash
.claude/skills/verify/verify.sh
```

Before a commit it checks what the staged files touch (`git diff --cached --name-only`). To verify without a commit, add
`--all-changes`, which adds unstaged changes (`git diff --name-only`). It checks:

- every `lambda/<function>/` with a changed file; a change in `lambda/shared/`, `lambda/tsconfig.lambda.json`,
  `lambda/package.json` or `lambda/package-lock.json` touches every Lambda;
- always the repo root.

A worktree has no `node_modules` of its own: the script first runs `npm ci`, one folder at a time, in each selected
folder that lacks one (`lambda/` once for all the Lambdas, which are one workspace).

It then runs every check at once, never stopping at a failure:

1. Repo root: `npm run prettier:ci`
2. Each touched Lambda, from its folder, each as its own check:
   1. `npm run prettier:ci`
   2. `npm run lint`
   3. `npx tsc --noEmit -p .` (the esbuild build doesn't type-check; this also checks the shared files it imports)
   4. `npm run build`
   5. `npx vitest run`, for a Lambda with a `vitest.config.mts` (all six; process-players' also runs `lambda/shared`'s
      specs)

Never run `npm test`: it's watch mode in every Lambda.

It prints each failed check's log (the last 60 lines of a long one, with the full log's path), then a `passed`/`FAILED`
line per check with its folder, command and seconds, and exits 1 when any failed.

## Report

One line per check: folder, command, passed or failed, quoting the relevant errors for each failure. Never claim a pass
without the script's output. Fix every failure in one round, then run the script again: `npm run prettier` and
`npm run lint -- --fix` fix what they can; fix the rest by hand. Don't commit while a check fails, and don't drop a
check to save time: the push gate covers only lint and Prettier.
