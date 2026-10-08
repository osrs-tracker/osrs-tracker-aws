import { getHiscore, HiscoreFetch, HiscoreResult } from '@osrs-tracker/hiscores';
import { Agent } from 'https';
import fetch from 'node-fetch';

const agent = new Agent({
  keepAlive: true,
  maxFreeSockets: 10,
  maxSockets: 50,
  timeout: 30000,
});

/** `node-fetch` with the shared keep-alive agent, so a batch's staggered requests reuse connections. */
const fetchWithAgent: HiscoreFetch = (url, init) => fetch(url, { ...init, agent });

/** Fetches a player's normal hiscore and logs why it wasn't found or failed. See {@link HiscoreResult}. */
export async function fetchHiscore(username: string): Promise<HiscoreResult> {
  const result = await getHiscore({ baseUrl: process.env.OSRS_API_BASE_URL!, username, fetch: fetchWithAgent });

  if (result.status === 'notFound')
    console.log(`Not on the hiscores (HTTP ${result.httpStatus}), skipping without retry: ${username}`);
  if (result.status === 'failed') console.log(`Hiscore request failed (${result.reason}) for username: ${username}`);

  return result;
}
