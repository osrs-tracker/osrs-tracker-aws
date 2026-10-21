import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PlayerScrapeMessageBody } from '@osrs-tracker/models';
import { Context, ScheduledEvent } from 'aws-lambda';
import { discordAlert } from '@lambda/shared/discord-alert';
import { invokeAsync } from '@lambda/shared/lambda.utils';
import { logCommit } from '@lambda/shared/commit';
import { scanSubscriptions } from './utils/subscriptions.utils';
import { chunks, scrapingOffsetForHour, usernamesForOffset } from './utils/queue.utils';
import { env } from './env';

logCommit();

const lambdaClient = new LambdaClient({ region: 'eu-central-1' });

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'eu-central-1' }));

export const handler = async (event: ScheduledEvent, context: Context) => {
  const scrapingOffset = scrapingOffsetForHour(new Date(event.time));

  const subscriptions = await scanSubscriptions(dynamo, env.SUBSCRIPTIONS_TABLE);

  // the ingester's sync refuses to empty the table, so an empty one was emptied or replaced by hand
  if (!subscriptions.length) {
    await discordAlert(
      env.WEBHOOK_URL,
      'No subscriptions',
      `${env.SUBSCRIPTIONS_TABLE} is empty: no players were queued for offset ${scrapingOffset}.`,
      context,
    );
    return context.logStreamName;
  }

  const usernames = usernamesForOffset(subscriptions, scrapingOffset);

  // one per process-players event. `invokeAsync` never rejects
  const invocations = chunks(usernames, env.PLAYERS_PER_EVENT).map((chunk) => {
    const payload: PlayerScrapeMessageBody = { usernames: chunk, scrapingOffset };
    return invokeAsync(lambdaClient, env.PROCESS_PLAYERS_FUNCTION, payload);
  });

  // events Lambda didn't accept, each logged by `invokeAsync`
  const errors = (await Promise.all(invocations)).filter((accepted) => !accepted).length;

  console.log('RESULT: ', {
    usernamesProcessed: usernames.length,
    eventsCreated: invocations.length,
    errors,
  });

  if (errors) await discordAlert(env.WEBHOOK_URL, 'Failed to queue players', `Error count: ${errors}`, context);

  return context.logStreamName;
};
