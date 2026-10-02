# Packages

Current versions and peer ranges are in each `@osrs-tracker/<package>/package.json`; check the consumers' own
`package.json` for what they use.

## Jagex hiscore change (new skill, boss or activity)

In `@osrs-tracker/hiscores`:

1. Add `src/parser/parse-order/<year>/po-YYYY-MM-DD.ts` exporting `PO_YYYY_MM_DD: ParseOrder`, with a doc comment naming
   the change. Copy the previous order and insert the new `SkillEnum`/`ActivityEnum` entry at Jagex's position.
2. Register it in that year's `index.ts` map under the key `'YYYY-MM-DDT11'` (the release hour, UTC). For a new year,
   add `<year>/index.ts` and spread it into `ParseOrderMap` in `parse-order.ts`.
3. Add new enum members to `models/hiscore.enum.ts`.
4. Add `po-YYYY-MM-DD.spec.ts` that parses a real hiscore string from the release day and asserts the new and
   neighbouring entries. Run with `npx jest`.

## Versioning

Bump `package.json`, add a `## vX.Y.Z - YYYY/MM/DD` entry to the package's `CHANGELOG.md` (models uses
`## X.Y.Z - YYYY/MM/DD`), build, and commit `dist/` too.

## Publish order

1. `models` first.
2. Then `hiscores`, widening its models peer range (e.g. `^old || ^new`). Only bump its models `devDependency` once the
   new models is live on npm, or `npm ci` (and CI) fails on the lockfile.
3. Then the consumers: bump the Lambdas here; ask the web and API sides to bump theirs. **The web must bump models and
   hiscores together**, or npm reports a peer conflict.

A new version can take about a minute to appear. Check `https://registry.npmjs.org/@osrs-tracker%2f<pkg>/<version>` for
a 200 rather than trusting `npm view` right away.

## Publishing

`npm publish` inside the package directory (`prepublishOnly` rebuilds), only after the user's go-ahead. npm requires
2FA, and the browser flow fails from a non-interactive shell (`EOTP`): ask the user for a fresh 6-digit OTP and run
`npm publish --otp=<code>` immediately, or let them publish from their own terminal.
