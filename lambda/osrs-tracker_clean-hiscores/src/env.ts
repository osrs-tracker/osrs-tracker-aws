import { cleanLambdaEnv, nonEmptyStr, positiveInt } from '../../shared/src/env';

/** The environment variables this Lambda reads besides the MongoDB ones and `DRY_RUN`, see `cleanLambdaEnv`. */
export const env = cleanLambdaEnv({
  MAX_AGE_IN_DAYS: positiveInt(),
  WEBHOOK_URL: nonEmptyStr(),
});
