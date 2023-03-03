import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Context, ScheduledEvent } from 'aws-lambda';
import chunk from 'lodash.chunk';
import { parseItemCategoriesResponse } from './item.utils';

const SQS_MESSAGE_BATCH_SIZE = 10; // max 10

const sqsClient = new SQSClient({ region: 'eu-central-1' });

export const handler = async (_event: ScheduledEvent, context: Context) => {
  // fetch item categories and parse to item pages
  const pages = parseItemCategoriesResponse(
    await fetch(process.env.OSRS_API_BASE_URL + '/m=itemdb_oldschool/api/catalogue/category.json?category=1').then(
      (res) => res.json(),
    ),
  );

  // create SQS messages, chunked per `process.env.ITEM_PAGES_PER_SQS_MESSAGE`
  const messages = chunk(pages, parseInt(process.env.ITEM_PAGES_PER_SQS_MESSAGE!)).map((batch, index) => ({
    Id: `${index}`,
    MessageBody: JSON.stringify(batch),
  }));

  let errors = 0;

  // send SQS messages in batches of 10 (max)
  const commands = chunk(messages, SQS_MESSAGE_BATCH_SIZE).map((batch) => {
    const command = new SendMessageBatchCommand({ QueueUrl: process.env.SQS_QUEUE_URL, Entries: batch });
    return sqsClient.send(command).catch(() => errors++);
  });

  await Promise.all(commands);

  console.log('RESULT: ', {
    pagesProcessed: pages.length,
    messagesSent: messages.length,
    commandsExecuted: commands.length,
    errors,
  });

  return context.logStreamName;
};
