import { url } from 'envalid';
import { cleanLambdaEnv, nonEmptyStr, positiveInt } from '@lambda/shared/env';

/** The environment variables this Lambda reads besides the MongoDB ones and `DRY_RUN`, see `cleanLambdaEnv`. */
export const env = cleanLambdaEnv({
  PLAYERS_PER_EVENT: positiveInt(),
  PROCESS_PLAYERS_FUNCTION: nonEmptyStr(),
  WEBHOOK_URL: url(),
});
