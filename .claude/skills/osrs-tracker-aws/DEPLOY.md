# Deploy a Lambda

`npm run deploy` (from `lambda/<fn>/`) builds, zips, uploads to `$LATEST` and publishes a numbered version. The triggers
call the unqualified function (`$LATEST`), so it's live immediately. Every `aws` call here, including the one inside
`npm run deploy`, runs as the `claude` profile; it sets `eu-central-1`.

1. Pass verification, then `npm run build` and compare the bundle size with the last deploy's (the esbuild metafile
   recipe in `CLAUDE.md` shows what grew). A jump you can't explain is a dependency that came along by accident.
2. Record the before state:

   ```bash
   aws lambda get-function-configuration --profile claude --function-name <fn> --query '{sha:CodeSha256,version:Version,modified:LastModified,runtime:Runtime}'
   ```

3. `AWS_PROFILE=claude npm run deploy`
4. Re-run step 2; confirm `CodeSha256` changed and note the new version (`aws lambda list-versions-by-function`, the
   highest number).
5. Watch the next run finish cleanly: `aws logs tail /aws/lambda/<fn> --profile claude --since 10m --follow`.
   queue-players and refresh-items run on the hour, process-players right after queue-players, clean-hiscores at 00:00
   UTC. Don't invoke a live Lambda by hand to check sooner: it does real writes, and a second clean-hiscores run on one
   day finds nothing to pull, so after its real clean-ups it alerts and fails.
6. Add a changelog entry with the new version number of each deployed Lambda.

## Rollback

Either redeploy an earlier version's code:

1. `aws lambda get-function --profile claude --function-name <fn> --qualifier <version> --query Code.Location` returns a
   presigned URL (valid for 10 minutes); download it to a zip outside the repo.
2. `aws lambda update-function-code --profile claude --function-name <fn> --zip-file fileb://<zip> --publish`

Or rebuild an earlier commit: `git checkout <prev> -- lambda/<fn> lambda/shared lambda/tsconfig.lambda.json`, `npm ci`
in `lambda/<fn>/`, `AWS_PROFILE=claude npm run deploy`, then `git checkout HEAD -- <same paths>` and `npm ci` again.
Checking out only `lambda/<fn>/src` keeps a bad change in `lambda/shared/` or the lockfile.

Record the rollback in the changelog like a deploy.
