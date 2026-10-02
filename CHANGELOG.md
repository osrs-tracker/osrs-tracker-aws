# Changelog

Changes to the Lambdas, AWS infrastructure and CI. Package changes are logged in each `@osrs-tracker/*` package's own
`CHANGELOG.md`.

## 2026/10/02

- Removed stale EventBridge targets for the deleted `osrs-tracker_hiscore-parser-validator` (`Hourly`) and
  `osrs-tracker_queue-items` (`four-hourly`) functions.
- Deleted the disabled SQS event-source mapping for the deleted `osrs-tracker_process-items` function.
- Deleted the empty EventBridge rules `bihourly` and `four-hourly`.
- Deleted 8 empty CloudWatch log groups belonging to deleted `osrs-tracker_*` functions.
- Added the `osrs-tracker-aws` project skill (`.claude/skills/osrs-tracker-aws/SKILL.md`), which documents the layout,
  console-managed infra, conventions, verification, deploy and commit workflow.
- Added this root changelog for Lambda, infra and CI changes.
