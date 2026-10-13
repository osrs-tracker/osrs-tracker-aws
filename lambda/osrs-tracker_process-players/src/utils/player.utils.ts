import { USER_AGENT } from '@lambda/shared/user-agent';
import { getHiscore, HiscoreResult } from '@osrs-tracker/hiscores';
import { env } from '../env';

/** Fetches a player's normal hiscore and logs why it wasn't found or failed. See {@link HiscoreResult}. */
export async function fetchHiscore(username: string): Promise<HiscoreResult> {
  const result = await getHiscore({
    baseUrl: env.OSRS_API_BASE_URL,
    username,
    fetch: (url, init) => fetch(url, { ...init, headers: { ...init.headers, 'user-agent': USER_AGENT } }),
  });

  if (result.status === 'notFound')
    console.log(`Not on the hiscores (HTTP ${result.httpStatus}), skipping without retry: ${username}`);
  if (result.status === 'failed') console.log(`Hiscore request failed (${result.reason}) for username: ${username}`);

  return result;
}
