import { url } from 'envalid';
import { cleanLambdaEnv, positiveInt } from '@lambda/shared/env';

/** The environment variables this Lambda reads besides the MongoDB ones and `DRY_RUN`, see `cleanLambdaEnv`. */
export const env = cleanLambdaEnv({
  PLAYERS_PER_SQS_MESSAGE: positiveInt(),
  SQS_QUEUE_URL: url(),
  WEBHOOK_URL: url(),
});
