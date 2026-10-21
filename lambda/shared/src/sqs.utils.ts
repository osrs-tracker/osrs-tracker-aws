import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { ScrapeResultMessage } from '@osrs-tracker/models';
import { DRY_RUN, logDryRun } from './dry-run.utils';

/**
 * The FIFO message group of a scrape result: one per offset, plus one for the player counts, so the ingester applies
 * each group's results in the order they were sent.
 */
export function scrapeResultGroupId(message: ScrapeResultMessage): string {
  return message.type === 'hiscores' ? `offset:${message.scrapingOffset}` : 'playerCount';
}

/**
 * Sends `message` to the scrape results queue (`queueUrl`, FIFO) in its group ({@link scrapeResultGroupId}). No
 * deduplication ID: the queue deduplicates by content, and an ID shared by a slot's messages would drop all but one.
 * Rejects with SQS's error when SQS didn't take it: the send is the scraping Lambdas' only write, so their run fails and
 * the result isn't lost silently. Only logged in `DRY_RUN`.
 */
export async function sendScrapeResult(
  sqsClient: SQSClient,
  queueUrl: string,
  message: ScrapeResultMessage,
): Promise<void> {
  const MessageGroupId = scrapeResultGroupId(message);

  if (DRY_RUN)
    return logDryRun(`send a ${message.type} result to the scrape results queue in group ${MessageGroupId}`, message);

  await sqsClient.send(
    new SendMessageCommand({ QueueUrl: queueUrl, MessageGroupId, MessageBody: JSON.stringify(message) }),
  );
}
