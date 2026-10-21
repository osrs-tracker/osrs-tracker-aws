import { SQSClient } from '@aws-sdk/client-sqs';
import { fetchWorldList, parseWorldList } from '@osrs-tracker/hiscores';
import { Context, ScheduledEvent } from 'aws-lambda';
import { discordAlertNeverRejects } from '@lambda/shared/discord-alert';
import { sendScrapeResult } from '@lambda/shared/sqs.utils';
import { USER_AGENT } from '@lambda/shared/user-agent';
import { logCommit } from '@lambda/shared/commit';
import { env } from './env';

logCommit();

const sqsClient = new SQSClient({ region: 'eu-central-1' });

/**
 * Samples Jagex's world list and sends the sample to the scrape results queue, for the ingester, which stores it and
 * recomputes the daily averages. A failed fetch, parse or send records nothing: it alerts and fails the run.
 */
export const handler = async (_event: ScheduledEvent, context: Context) => {
  const date = new Date().toISOString();

  try {
    const counts = parseWorldList(
      // undici's own timeouts are 300 s; fail a stalled request well within the Lambda's 30 s timeout
      await fetchWorldList({ timeoutMs: 15_000, userAgent: USER_AGENT }),
    );
    if (counts.worlds === 0 || counts.total === 0)
      throw new Error(`The world list has ${counts.worlds} worlds and ${counts.total} players.`);

    await sendScrapeResult(sqsClient, env.SCRAPE_RESULTS_QUEUE_URL, {
      v: 1,
      type: 'playerCount',
      playerCount: { date, ...counts },
    });

    console.info(
      `Sent ${counts.total} players (${counts.members} members, ${counts.f2p} F2P) on ${counts.worlds} worlds to the scrape results queue.`,
    );
  } catch (e) {
    // never rejects, so the run fails with the original error, not the alert's
    await discordAlertNeverRejects(env.WEBHOOK_URL, 'Player count not recorded', String(e), context);
    throw e;
  }

  return context.logStreamName;
};
