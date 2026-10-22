import { url } from 'envalid';
import { cleanLambdaEnv, positiveInt } from '@lambda/shared/env';

/** The environment variables this Lambda reads besides `DRY_RUN`, see `cleanLambdaEnv`. */
export const env = cleanLambdaEnv({
  OSRS_API_BASE_URL: url(),
  PLAYERS_PER_EVENT: positiveInt(),
  // osrs-tracker_scrape-results.fifo, which the ingester applies to MongoDB
  SCRAPE_RESULTS_QUEUE_URL: url(),
  WEBHOOK_URL: url(),
});
