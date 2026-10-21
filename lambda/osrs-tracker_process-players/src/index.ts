import { LambdaClient } from '@aws-sdk/client-lambda';
import { Context } from 'aws-lambda';
import { ServerApiVersion } from 'mongodb';
import { logCommit } from '@lambda/shared/commit';
import { afterWrites, BulkWrite } from './utils/after-writes';
import { discordAlert } from './utils/discord-alert';
import { MU } from './utils/mongo.utils';
import { ScrapeEvent, scrapeMessage } from './utils/scrape-message';

logCommit();

const lambdaClient = new LambdaClient({ region: 'eu-central-1' });

const client = MU.client({ serverApi: { version: ServerApiVersion.v1, deprecationErrors: true } });

export const handler = async (event: ScrapeEvent, context: Context) => {
  if (event.usernames.length === 0) {
    console.log('No players to process');
    return context.logStreamName;
  }

  // `scrapeMessage` never rejects
  const scraped = await scrapeMessage(client, event);
  const { failedUsernames, notFoundUsernames, pausedUsernames } = scraped;

  // throw error if nothing was written because every scrape failed, so Lambda retries the event (twice, 1 and 2
  // minutes later). The only throw: once the bulk write started, a retry would store duplicates for the part of its
  // entries it stored before failing, so `afterWrites` never rejects. Dont requeue here or we will get stuck in a loop
  // (an event where every player is not on the hiscores completes normally, there's nothing to retry). When a 404 was
  // recorded, a retry would record it again, so `afterWrites` requeues the failed players in a new event instead; that
  // event has no 404s left and throws here if it fails again
  if (scraped.bulkUpdateOps.length === 0 && notFoundUsernames.length === 0) {
    if (event.retry) await discordAlert('No players were updated', failedUsernames, context);

    throw new Error(`No players were updated. Failed to update ${failedUsernames.length} players.`);
  }

  // settled as soon as it's started, so `afterWrites` can't reject on it. None when no player was found
  const bulkWrite: BulkWrite | undefined = scraped.bulkUpdateOps.length
    ? {
        usernames: scraped.bulkUpdateUsernames,
        result: MU.bulkWrite(client, scraped.bulkUpdateOps).then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason: unknown) => ({ status: 'rejected' as const, reason }),
        ),
      }
    : undefined;

  await afterWrites(lambdaClient, { event, bulkWrite, failedUsernames, notFoundUsernames, pausedUsernames }, context);

  return context.logStreamName;
};
