import { url } from 'envalid';
import { cleanLambdaEnv, nonEmptyStr } from '@lambda/shared/env';

/** The environment variables this Lambda reads besides the MongoDB ones and `DRY_RUN`, see `cleanLambdaEnv`. */
export const env = cleanLambdaEnv({
  // the daily averages (`playerCountsDaily`), in the same database as `MONGODB_COLLECTION`
  MONGODB_DAILY_COLLECTION: nonEmptyStr(),
  WEBHOOK_URL: url(),
});
