import { LambdaClient } from '@aws-sdk/client-lambda';
import { PlayerScrapeMessageBody } from '@osrs-tracker/models';
import { Context, ScheduledEvent } from 'aws-lambda';
import { discordAlert } from '@lambda/shared/discord-alert';
import { invokeAsync } from '@lambda/shared/lambda.utils';
import { ensureIndex } from '@lambda/shared/mongo.utils';
import { logCommit } from '@lambda/shared/commit';
import { MU } from './utils/mongo.utils';
import { chunks, scrapingOffsetForHour } from './utils/queue.utils';
import { env } from './env';

logCommit();

const lambdaClient = new LambdaClient({ region: 'eu-central-1' });

const client = MU.client();

export const handler = async (event: ScheduledEvent, context: Context) => {
  const scrapingOffset = scrapingOffsetForHour(new Date(event.time));

  // ensure index on scrapingOffsets
  await ensureIndex(MU.col(client), { scrapingOffsets: 1 }, { sparse: true });

  // get usernames for scrapingOffset as cursor
  const usernameCursor = MU.getAllUsernamesForOffset(client, scrapingOffset);

  // statistics
  let usernamesProcessed = 0;
  // one per process-players event, started as soon as the event's usernames are read. `invokeAsync` never rejects, so
  // they're only awaited once the cursor is done
  const invocations: Promise<boolean>[] = [];

  try {
    for await (const usernames of chunks(usernameCursor, env.PLAYERS_PER_EVENT)) {
      usernamesProcessed += usernames.length;

      const payload: PlayerScrapeMessageBody = { usernames, scrapingOffset };
      invocations.push(invokeAsync(lambdaClient, env.PROCESS_PLAYERS_FUNCTION, payload));
    }
  } finally {
    // close the cursor
    await usernameCursor.close();
  }

  // events Lambda didn't accept, each logged by `invokeAsync`
  const errors = (await Promise.all(invocations)).filter((accepted) => !accepted).length;

  console.log('RESULT: ', {
    usernamesProcessed,
    eventsCreated: invocations.length,
    errors,
  });

  if (errors) await discordAlert(env.WEBHOOK_URL, 'Failed to queue players', `Error count: ${errors}`, context);

  return context.logStreamName;
};
