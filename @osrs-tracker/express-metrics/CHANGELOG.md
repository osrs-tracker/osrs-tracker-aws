## Unreleased

- Dev tooling only (issues #130 and #131, from the tech-debt roadmap #103): linted with the Lambdas' config
  (`npm run lint`, also in CI), with oxlint instead of ESLint until typescript-eslint supports TypeScript 7 (#143). It
  found nothing to fix; the build is unchanged.
- Dev tooling only (issues #129 and #131, from the tech-debt roadmap #103): TypeScript `^7.0.2` (was `^5.9.3`), with
  `bundler` module resolution and `rootDir: "src"`, the options TypeScript 7 requires. The build is byte-for-byte the
  same.
- Dev tooling only (issue #108, from the tech-debt roadmap #103): TypeScript `^5.9.3` (the build is byte-for-byte the
  same) and `vitest.config.mts`, which silences Vite's warning about ESM syntax in a file loaded as CommonJS.

## 0.1.1 - 2026-10-09

- Licensed under Apache-2.0 instead of MIT, with a `NOTICE` file that copies must keep. Earlier versions stay MIT. The
  tarball now holds only `dist/`, the README, `CHANGELOG.md`, `LICENSE` and `NOTICE` (no more `src/`, tests or configs).

## 0.1.0 - 2026-10-09

- First release: `metricsMiddleware` records `http_request_duration_seconds` and `up` with the same names, labels,
  buckets and help text as `express-prom-bundle` 8 (including status `499` for requests the client closed), serves them
  from a separate metrics app, and adds Node's default process metrics unless `defaultMetrics: false`. Built on
  `@prometheus-io/client` 0.16, which replaces the deprecated `prom-client`. Re-exports `register`, `Registry`,
  `Counter`, `Gauge`, `Histogram` and `Summary` for app-specific metrics.
