# Deploy a Lambda

`npm run deploy` (from `lambda/<fn>/`) builds, zips and publishes to `$LATEST`, live immediately.

1. Pass verification and check the bundle in `dist/index.js`.
2. Record the before state:

   ```bash
   aws lambda get-function-configuration --function-name <fn> --query '{sha:CodeSha256,version:Version,modified:LastModified,runtime:Runtime}'
   ```

3. `npm run deploy`
4. Re-run step 2; confirm `CodeSha256` changed and note the new version.
5. Watch the next run finish cleanly: `aws logs tail /aws/lambda/<fn> --since 10m --follow`

## Rollback

Upload the previous version's zip (`aws lambda get-function --function-name <fn> --qualifier <version>`), or redeploy
the previous commit's source (`git checkout <prev> -- lambda/<fn>/src`, `npm run deploy`, restore).
