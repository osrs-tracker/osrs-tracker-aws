import { url } from 'envalid';
import { cleanLambdaEnv, nonEmptyStr, positiveInt } from '../../shared/src/env';

/** The environment variables this Lambda reads besides the MongoDB ones and `DRY_RUN`, see `cleanLambdaEnv`. */
export const env = cleanLambdaEnv({
  OSRS_API_BASE_URL: url(),
  PLAYERS_PER_SQS_MESSAGE: positiveInt(),
  SQS_QUEUE_URL: url(),
  WEBHOOK_URL: nonEmptyStr(),
});
