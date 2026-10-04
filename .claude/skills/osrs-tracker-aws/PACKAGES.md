# Packages

## Jagex hiscore change (new skill, boss or activity)

In `@osrs-tracker/hiscores`:

1. Add `src/parser/parse-order/<year>/po-YYYY-MM-DD.ts` exporting `PO_YYYY_MM_DD: ParseOrder`, with a doc comment naming
   the change: copy the previous order and insert the new entry at Jagex's position.
2. Register it in that year's `index.ts` under `'YYYY-MM-DDT11'` (the release hour, UTC). For a new year, add
   `<year>/index.ts` and spread it into `ParseOrderMap` in `parse-order.ts`.
3. Add new members to `models/hiscore.enum.ts`.
4. Add `po-YYYY-MM-DD.spec.ts` that parses a real hiscore string from the release day and asserts the new and
   neighbouring entries.

## Versioning

Bump `package.json`, add a `## vX.Y.Z - YYYY/MM/DD` entry to the package's `CHANGELOG.md` (models: `## X.Y.Z - …`),
build, and commit `dist/`.

## Publish order

1. `models`.
2. `hiscores`, widening its models peer range (e.g. `^old || ^new`). Only bump its models `devDependency` once the new
   models is live, or `npm ci` fails on the lockfile.
3. The consumers: the Lambdas here, then the web and API. **The web must bump models and hiscores together.**

A new version takes about a minute to appear: wait for a 200 from
`https://registry.npmjs.org/@osrs-tracker%2f<pkg>/<version>` rather than trusting `npm view`.

## Publishing

`npm publish` in the package directory. npm requires 2FA, and the browser flow fails from a non-interactive shell
(`EOTP`): ask the user for a fresh OTP and run `npm publish --otp=<code>` immediately, or let them publish themselves.
