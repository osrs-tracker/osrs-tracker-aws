import { fetchWorldList, parseWorldList } from '@osrs-tracker/hiscores';
import { PlayerCount } from '@osrs-tracker/models';
import { Context, ScheduledEvent } from 'aws-lambda';
import { discordAlertNeverRejects } from '@lambda/shared/discord-alert';
import { ensureIndex } from '@lambda/shared/mongo.utils';
import { USER_AGENT } from '@lambda/shared/user-agent';
import { logCommit } from '@lambda/shared/commit';
import { MU } from './utils/mongo.utils';
import { env } from './env';

logCommit();

const client = MU.client();

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

  return context.logStreamName;
};
