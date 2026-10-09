## Unreleased

- Licensed under Apache-2.0 instead of MIT, with a `NOTICE` file that copies must keep. Earlier versions stay MIT. The
  tarball now holds only `dist/`, the README, `CHANGELOG.md`, `LICENSE` and `NOTICE` (no more `src/`, tests or configs).

## v0.1.0 - 2026/10/09

- First release: `metricsMiddleware` records `http_request_duration_seconds` and `up` with the same names, labels,
  buckets and help text as `express-prom-bundle` 8 (including status `499` for requests the client closed), serves them
  from a separate metrics app, and adds Node's default process metrics unless `defaultMetrics: false`. Built on
  `@prometheus-io/client` 0.16, which replaces the deprecated `prom-client`. Re-exports `register`, `Registry`,
  `Counter`, `Gauge`, `Histogram` and `Summary` for app-specific metrics.
