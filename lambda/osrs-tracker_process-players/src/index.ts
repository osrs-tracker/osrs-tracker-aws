import { SQSClient } from '@aws-sdk/client-sqs';
import { PlayerScrapeMessageBody } from '@osrs-tracker/models';
import { Context, SQSEvent } from 'aws-lambda';
import { ServerApiVersion } from 'mongodb';
import { logCommit } from '@lambda/shared/commit';
import { afterWrites, BulkWrite } from './utils/after-writes';
import { discordAlert } from './utils/discord-alert';
import { mapArrayPush } from './utils/map.utils';
import { MU } from './utils/mongo.utils';
import { scrapeMessage } from './utils/scrape-message';

logCommit();

const sqsClient = new SQSClient({ region: 'eu-central-1' });

const client = MU.client({ serverApi: { version: ServerApiVersion.v1, deprecationErrors: true } });

export const handler = async (event: SQSEvent, context: Context) => {
  // Parse message bodies
  const messageBodies: PlayerScrapeMessageBody[] = event.Records.map((record) => JSON.parse(record.body));

  // Logs max SQS retry count (ApproximateReceiveCount) so we can see how many times the messages were delivered.
  const maxReceiveCount = event.Records.reduce(
    (acc, val) => Math.max(acc, parseInt(val.attributes.ApproximateReceiveCount)),
    0,
  );

  if (messageBodies.length === 0) {
    console.log('No messages to process');
    return context.logStreamName;
  }

  // map of failed (retryable) usernames by scrapingOffset
  const failedMap: Map<number, string[]> = new Map();
  const notFoundUsernames: string[] = [];
  const pausedUsernames: string[] = [];

  // bulk writes, one per message, with the usernames each one stores a hiscore entry for. Each write is settled as soon
  // as it's started: it's only awaited after the later messages are scraped, and a rejection left unhandled until then
  // would crash the invocation (and SQS would retry it, storing duplicates)
  const bulkWrites: BulkWrite[] = [];

  // scrape each message body sequentially. `scrapeMessage` never rejects, since an earlier message's write may already
  // be running
  for (const messageBody of messageBodies) {
    const scraped = await scrapeMessage(client, messageBody);
    scraped.failedUsernames.forEach((username) => mapArrayPush(failedMap, messageBody.scrapingOffset, username));
    notFoundUsernames.push(...scraped.notFoundUsernames);
    pausedUsernames.push(...scraped.pausedUsernames);

    // Only bulk update if there are any updates, can be empty if all usernames failed
    if (!scraped.bulkUpdateOps.length) continue;

    bulkWrites.push({
      usernames: scraped.bulkUpdateUsernames,
      result: MU.bulkWrite(client, scraped.bulkUpdateOps).then(
        (value) => ({ status: 'fulfilled' as const, value }),
        (reason: unknown) => ({ status: 'rejected' as const, reason }),
      ),
    });
  }

  const attemptedPlayerCount =
    messageBodies.reduce((acc, body) => acc + body.usernames.length, 0) - notFoundUsernames.length;

  // throw error if nothing was written because every scrape failed, so SQS retries the whole message. The only throw:
  // once a bulk write started, a retry would store duplicates for the other writes, or for the part of its own entries
  // it stored before failing, so `afterWrites` never rejects. Dont send new SQS messages or we will get stuck in a loop
  // (a message where every player is not on the hiscores completes normally, there's nothing to retry). When a 404 was
  // recorded, a retry would record it again, so `afterWrites` queues the failed players in a new message instead; that
  // message has no 404s left and throws here if it fails again
  if (attemptedPlayerCount > 0 && bulkWrites.length === 0 && notFoundUsernames.length === 0) {
    const failedUsernames = [...failedMap.values()].flat();
    if (maxReceiveCount > 1) await discordAlert('No players were updated', failedUsernames, context);

    throw new Error(`No players were updated. Failed to update ${failedUsernames.length} players.`);
  }

  await afterWrites(sqsClient, { bulkWrites, failedMap, notFoundUsernames, pausedUsernames, maxReceiveCount }, context);

  return context.logStreamName;
};
