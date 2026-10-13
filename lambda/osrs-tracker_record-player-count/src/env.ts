import { url } from 'envalid';
import { cleanLambdaEnv } from '@lambda/shared/env';

/** The environment variables this Lambda reads besides the MongoDB ones and `DRY_RUN`, see `cleanLambdaEnv`. */
export const env = cleanLambdaEnv({
  WEBHOOK_URL: url(),
});
