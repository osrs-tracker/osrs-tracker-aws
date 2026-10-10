# Packages

## Jagex hiscore change (new skill, boss or activity)

From `@osrs-tracker/hiscores` 4.0.0 (roadmap osrs-tracker/osrs-tracker-aws#52), entries are mapped by name from Jagex's
response (`fromJagex`), so a new skill or activity is stored, served and diffed without a release. Add the member to
`SkillEnum` or `ActivityEnum` in `@osrs-tracker/models` (`src/models/hiscore.enum.ts`), with the value exactly as the
`name` in Jagex's JSON hiscores, only when code refers to that name (the web's display layouts and categories), and
release a models minor; hiscores re-exports the enums. Until 4.0.0 is live, the enums are in hiscores
(`src/models/hiscore.enum.ts`) and the old rule applies: add the member there and release a hiscores minor.

## Versioning

Bump `package.json`, add a `## vX.Y.Z - YYYY/MM/DD` entry to the package's `CHANGELOG.md` (models: `## X.Y.Z - …`), and
verify (the build is a local check only: `dist/` isn't committed, and `prepublishOnly` rebuilds it on publish). An
`## Unreleased` section becomes that version's entry.

## Publishing

`npm publish` in the package directory. 2FA's browser flow fails from a non-interactive shell (`EOTP`): ask the user for
a fresh OTP and run `npm publish --otp=<code>` immediately, or let them publish.

Order:

1. `models`.
2. `hiscores`, widening its models peer range (e.g. `^old || ^new`), or narrowing it to the new major when hiscores
   needs it (hiscores 4.0.0 takes only models `^2.0.0`). Bump its models `devDependency` only once the new models is
   live, or `npm ci` fails on the lockfile.
3. Consumers: the Lambdas here, then web and API. **The web must bump models and hiscores together.**

`express-metrics` stands alone (no `@osrs-tracker/*` dependencies); its consumers are the web and API servers. Its
series (`http_request_duration_seconds` names, labels, buckets and help text, `up`) are what Prometheus scrapes and
dashboards query: changing them is a breaking change, and its tests pin them.

`logger` stands alone too, with the same consumers. Its line shape (`level` names, `time`, `type`, `message`, `error`,
and the request fields `status`, `aborted`, `route`, `responseTime`, …) is what Loki queries and runbooks filter on:
changing a field name or level name is a breaking change, and its tests pin them.

Wait for a 200 from `https://registry.npmjs.org/@osrs-tracker%2f<pkg>/<version>` (about a minute) rather than trusting
`npm view`.
