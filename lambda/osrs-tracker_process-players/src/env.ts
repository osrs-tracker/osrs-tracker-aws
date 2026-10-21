import { url } from 'envalid';
import { cleanLambdaEnv, positiveInt } from '@lambda/shared/env';

/** The environment variables this Lambda reads besides the MongoDB ones and `DRY_RUN`, see `cleanLambdaEnv`. */
export const env = cleanLambdaEnv({
  OSRS_API_BASE_URL: url(),
  PLAYERS_PER_EVENT: positiveInt(),
  WEBHOOK_URL: url(),
});
