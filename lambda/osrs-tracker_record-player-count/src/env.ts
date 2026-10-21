import { url } from 'envalid';
import { cleanLambdaEnv, nonEmptyStr } from '@lambda/shared/env';

/** The environment variables this Lambda reads besides the MongoDB ones and `DRY_RUN`, see `cleanLambdaEnv`. */
export const env = cleanLambdaEnv({
  // the daily averages (`playerCountsDaily`), in the same database as `MONGODB_COLLECTION`
  MONGODB_DAILY_COLLECTION: nonEmptyStr(),
  // osrs-tracker_scrape-results.fifo, which the ingester applies to MongoDB
  SCRAPE_RESULTS_QUEUE_URL: url(),
  WEBHOOK_URL: url(),
});
