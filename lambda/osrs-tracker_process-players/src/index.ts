import { LambdaClient } from '@aws-sdk/client-lambda';
import { SQSClient } from '@aws-sdk/client-sqs';
import { Context } from 'aws-lambda';
import { logCommit } from '@lambda/shared/commit';
import { afterWrites, AwsClients } from './utils/after-writes';
import { discordAlert } from './utils/discord-alert';
import { ScrapeEvent, scrapeMessage } from './utils/scrape-message';

logCommit();

const awsClients: AwsClients = {
  lambda: new LambdaClient({ region: 'eu-central-1' }),
  sqs: new SQSClient({ region: 'eu-central-1' }),
};

export const handler = async (event: ScrapeEvent, context: Context) => {
  if (event.usernames.length === 0) {
    console.log('No players to process');
    return context.logStreamName;
  }

  // `scrapeMessage` never rejects
  const scraped = await scrapeMessage(event);
  const { found, failedUsernames, notFoundUsernames } = scraped;

  // throw error if there's nothing to send because every scrape failed, so Lambda retries the event (twice, 1 and 2
  // minutes later). Dont requeue here or we will get stuck in a loop (an event where every player is not on the
  // hiscores is sent and completes normally, there's nothing to retry). The other throw is a failed send in
  // `afterWrites`; once a run sent its results, `afterWrites` requeues the failed players in a new event instead
  if (found.length === 0 && notFoundUsernames.length === 0) {
    if (event.retry) await discordAlert('No players were updated', failedUsernames, context);

    throw new Error(`No players were updated. Failed to update ${failedUsernames.length} players.`);
  }

  await afterWrites(awsClients, { event, ...scraped }, context);

  return context.logStreamName;
};
