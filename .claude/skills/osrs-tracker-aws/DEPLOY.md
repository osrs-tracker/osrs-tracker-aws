# Deploy a Lambda

`npm run deploy` (from `lambda/<fn>/`) builds, zips and publishes the code to `$LATEST`, live immediately.

1. Pass the verification steps and check the bundle in `dist/index.js`.
2. Record the before state:

   ```bash
   aws lambda get-function-configuration --function-name <fn> --query '{sha:CodeSha256,version:Version,modified:LastModified,runtime:Runtime}'
   ```

3. `npm run deploy`
4. Re-run step 2 and confirm `CodeSha256` changed; note the new version.
5. Watch the next run finish without errors: `aws logs tail /aws/lambda/<fn> --since 10m --follow`
6. Log the deploy in the root `CHANGELOG.md`.

## Rollback

Upload the previous version's code (`aws lambda get-function --function-name <fn> --qualifier <version>` gives its zip),
or redeploy the previous commit's source (`git checkout <prev> -- lambda/<fn>/src`, `npm run deploy`, restore).
