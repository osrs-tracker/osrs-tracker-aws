import { url } from 'envalid';
import { cleanLambdaEnv } from '@lambda/shared/env';

/** The environment variables this Lambda reads besides `DRY_RUN`, see `cleanLambdaEnv`. It has no database. */
export const env = cleanLambdaEnv({
  WEBHOOK_URL: url(),
});
