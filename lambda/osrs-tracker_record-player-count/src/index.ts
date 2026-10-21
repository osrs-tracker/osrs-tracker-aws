import { SQSClient } from '@aws-sdk/client-sqs';
import { fetchWorldList, parseWorldList } from '@osrs-tracker/hiscores';
import { PlayerCount } from '@osrs-tracker/models';
import { Context, ScheduledEvent } from 'aws-lambda';
import { discordAlertNeverRejects } from '@lambda/shared/discord-alert';
import { ensureIndex } from '@lambda/shared/mongo.utils';
import { sendScrapeResult } from '@lambda/shared/sqs.utils';
import { USER_AGENT } from '@lambda/shared/user-agent';
import { logCommit } from '@lambda/shared/commit';
import { MU } from './utils/mongo.utils';
import { env } from './env';

logCommit();

const client = MU.client();

const sqsClient = new SQSClient({ region: 'eu-central-1' });

export const handler = async (_event: ScheduledEvent, context: Context) => {
  const date = new Date();

  let playerCount: PlayerCount;
  try {
    const counts = parseWorldList(
      // undici's own timeouts are 300 s; fail a stalled request well within the Lambda's 30 s timeout
      await fetchWorldList({ timeoutMs: 15_000, userAgent: USER_AGENT }),
    );
    if (counts.worlds === 0 || counts.total === 0)
      throw new Error(`The world list has ${counts.worlds} worlds and ${counts.total} players.`);
    playerCount = { date, ...counts };
  } catch (e) {
    // never rejects, so the run fails with the world list's error, not the alert's
    await discordAlertNeverRejects(env.WEBHOOK_URL, 'Player count not recorded', String(e), context);
    throw e;
  }

  await ensureIndex(MU.col(client), { date: 1 });
  await MU.insertPlayerCount(client, playerCount);

  console.info(
    `Recorded ${playerCount.total} players (${playerCount.members} members, ${playerCount.f2p} F2P) on ${playerCount.worlds} worlds.`,
  );

  await updatePlayerCountDays(context);
  await sendPlayerCount(playerCount, context);

  return context.logStreamName;
};

/**
 * Recomputes the daily averages from the newest stored day on: normally today, also yesterday on the first run after
 * midnight, and every sample when there are none yet. Never rejects: the sample is stored, and the next run recomputes
 * whatever this one missed.
 */
async function updatePlayerCountDays(context: Context): Promise<void> {
  try {
    await ensureIndex(MU.days(client), { date: 1 }, { unique: true });
    const from = await MU.newestPlayerCountDay(client);
    await MU.mergePlayerCountDays(client, from);
    console.info(`Updated the daily player counts from ${from?.toISOString().slice(0, 10) ?? 'the first sample'} on.`);
  } catch (e) {
    console.error('Failed to update the daily player counts', e);
    await discordAlertNeverRejects(env.WEBHOOK_URL, 'Daily player counts not updated', String(e), context);
  }
}

/**
 * Sends the sample to the scrape results queue, for the ingester, which finds it stored already while this Lambda
 * still writes MongoDB (osrs-tracker/osrs-tracker-aws#165). Never rejects: the sample is stored, so a failed send only
 * alerts.
 */
async function sendPlayerCount(playerCount: PlayerCount, context: Context): Promise<void> {
  // by name, not spread: the insert added the sample's `_id` to it
  const { total, members, f2p, worlds, byLocation } = playerCount;
  const date = playerCount.date.toISOString();

  const sent = await sendScrapeResult(sqsClient, env.SCRAPE_RESULTS_QUEUE_URL, {
    v: 1,
    type: 'playerCount',
    playerCount: { date, total, members, f2p, worlds, byLocation },
  });
  if (!sent)
    await discordAlertNeverRejects(
      env.WEBHOOK_URL,
      'Player count not sent',
      `The sample of ${date} is stored, but the scrape results queue didn't take it.`,
      context,
    );
}
