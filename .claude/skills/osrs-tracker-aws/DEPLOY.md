# Deploy a Lambda

`npm run deploy` builds, zips and runs `aws lambda update-function-code … --publish`. The code is live on `$LATEST`
immediately, so get the user's explicit go-ahead first.

1. Pass the verification steps in [SKILL.md](SKILL.md) and check the bundle in `dist/index.js`.
2. Record the before state:

   ```bash
   aws lambda get-function-configuration --function-name <fn> --query '{sha:CodeSha256,version:Version,modified:LastModified,runtime:Runtime}'
   ```

3. Deploy from `lambda/<fn>/`:

   ```bash
   npm run deploy
   ```

4. Re-run step 2 and confirm `CodeSha256` changed; note the new version from the deploy output.
5. Watch the next scheduled or SQS-triggered run for its normal summary without errors:

   ```bash
   aws logs tail /aws/lambda/<fn> --since 10m --follow
   ```

6. Log the deploy in the root `CHANGELOG.md`, commit and push.

## Rollback

Download the previous published version's code with `aws lambda get-function --function-name <fn> --qualifier <version>`
and upload its zip, or redeploy the previous commit's source (`git checkout <prev> -- lambda/<fn>/src`,
`npm run deploy`, then restore the files).
