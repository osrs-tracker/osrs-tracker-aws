import { url } from 'envalid';
import { cleanLambdaEnv } from '@lambda/shared/env';

/** The environment variables this Lambda reads besides `DRY_RUN`, see `cleanLambdaEnv`. */
export const env = cleanLambdaEnv({
  // osrs-tracker_scrape-results.fifo, which the ingester applies to MongoDB
  SCRAPE_RESULTS_QUEUE_URL: url(),
  WEBHOOK_URL: url(),
});
