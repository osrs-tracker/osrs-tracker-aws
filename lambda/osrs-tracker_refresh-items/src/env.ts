import { cleanLambdaEnv } from '../../shared/src/env';

/** The environment variables this Lambda reads: only the MongoDB ones and `DRY_RUN`, see `cleanLambdaEnv`. */
export const env = cleanLambdaEnv({});
