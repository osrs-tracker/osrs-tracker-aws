# Packages

## Jagex hiscore change (new skill, boss or activity)

Add the member to `SkillEnum` or `ActivityEnum` in `@osrs-tracker/hiscores` (`src/models/hiscore.enum.ts`), with the
value exactly as the `name` in Jagex's JSON hiscores (the web matches skills and activities by name), and release a
minor version. Stored entries come from the JSON hiscores, so there's no parse order to add (removed in 3.0.0).

## Versioning

Bump `package.json`, add a `## vX.Y.Z - YYYY/MM/DD` entry to the package's `CHANGELOG.md` (models: `## X.Y.Z - …`),
build, and commit `dist/`.

## Publishing

`npm publish` in the package directory. 2FA's browser flow fails from a non-interactive shell (`EOTP`): ask the user for
a fresh OTP and run `npm publish --otp=<code>` immediately, or let them publish.

Order:

1. `models`.
2. `hiscores`, widening its models peer range (e.g. `^old || ^new`). Bump its models `devDependency` only once the new
   models is live, or `npm ci` fails on the lockfile.
3. Consumers: the Lambdas here, then web and API. **The web must bump models and hiscores together.**

`express-metrics` stands alone (no `@osrs-tracker/*` dependencies); its consumers are the web and API servers. Its
series (`http_request_duration_seconds` names, labels, buckets and help text, `up`) are what Prometheus scrapes and
dashboards query: changing them is a breaking change, and its tests pin them.

Wait for a 200 from `https://registry.npmjs.org/@osrs-tracker%2f<pkg>/<version>` (about a minute) rather than trusting
`npm view`.
