# Deploy a Lambda

`npm run deploy` (from `lambda/<fn>/`) builds, zips, uploads to `$LATEST` and publishes a numbered version. The triggers
call the unqualified function (`$LATEST`), so it's live immediately. Every `aws` call here, including the one inside
`npm run deploy`, runs as the `claude` profile; it sets `eu-central-1`.

1. Pass verification and commit, then `npm run build` and compare the bundle size with the last deploy's (the esbuild
   metafile recipe in `CLAUDE.md` shows what grew). A jump you can't explain is a dependency that came along by
   accident. The bundle logs the commit it was built from at every cold start, with `-dirty` when `lambda/` had
   uncommitted changes, which then don't match any commit.
2. Record the before state:

   ```bash
   aws lambda get-function-configuration --profile claude --function-name <fn> --query '{sha:CodeSha256,version:Version,modified:LastModified,runtime:Runtime}'
   ```

3. `AWS_PROFILE=claude npm run deploy`
4. Re-run step 2; confirm `CodeSha256` changed and note the new version (`aws lambda list-versions-by-function`, the
   highest number).
5. Watch the next run finish cleanly: `aws logs tail /aws/lambda/<fn> --profile claude --since 10m --follow`. Its first
   line (the new code always starts cold) is `Built from commit <sha>`: check it's the commit you deployed.
   queue-players and refresh-items run on the hour, process-players right after queue-players, clean-hiscores at 00:00
   UTC, record-player-count every 10 minutes. Don't invoke a live Lambda by hand to check sooner: it does real writes.
6. Add a changelog entry with the new version number and that commit for each deployed Lambda ("deployed as version 3,
   commit 1a2b3c4").

## Rollback

Either redeploy an earlier version's code:

1. `aws lambda get-function --profile claude --function-name <fn> --qualifier <version> --query Code.Location` returns a
   presigned URL (valid for 10 minutes); download it to a zip outside the repo.
2. `aws lambda update-function-code --profile claude --function-name <fn> --zip-file fileb://<zip> --publish`

Or rebuild an earlier commit in a worktree of its own, so no file from a later commit (`lambda/shared/`, the lockfile)
gets into the build: `git worktree add <dir outside the repo> <prev>`, `npm ci` in its `lambda/` (for a commit from
before the workspace of 2026-10-14: in `lambda/<fn>/`), `AWS_PROFILE=claude npm run deploy` in `lambda/<fn>/`, then
`git worktree remove <dir>`. The bundle logs `<prev>` as its commit; record it in the changelog.

Record the rollback in the changelog like a deploy.
