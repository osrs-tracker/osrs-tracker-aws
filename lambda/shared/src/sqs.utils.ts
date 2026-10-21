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
 * Never rejects: returns false, and logs the error, when SQS didn't take it, so process-players can use it after its
 * bulk writes. True without sending in `DRY_RUN`.
 */
export async function sendScrapeResult(
  sqsClient: SQSClient,
  queueUrl: string,
  message: ScrapeResultMessage,
): Promise<boolean> {
  const MessageGroupId = scrapeResultGroupId(message);

  if (DRY_RUN) {
    logDryRun(`send a ${message.type} result to the scrape results queue in group ${MessageGroupId}`, message);
    return true;
  }

  try {
    await sqsClient.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageGroupId, MessageBody: JSON.stringify(message) }),
    );
    return true;
  } catch (e) {
    console.error(`Failed to send a ${message.type} result to the scrape results queue`, { MessageGroupId, error: e });
    return false;
  }
}
