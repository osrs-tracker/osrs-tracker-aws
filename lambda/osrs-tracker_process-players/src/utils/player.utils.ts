import { HiscoreActivity, HiscoreSkill } from '@osrs-tracker/models';
import { Agent } from 'https';
import fetch from 'node-fetch';

type JsonResponse = {
  name: string;
  skills: HiscoreSkill[];
  activities: HiscoreActivity[];
};

/** Max time for a single hiscore request, so one slow response can't stretch the whole batch. */
const HISCORE_FETCH_TIMEOUT_MS = 10_000;

/**
 * - `found`: the hiscore was fetched.
 * - `notFound`: HTTP 404, the player is not on the hiscores (renamed, banned or unranked). Permanent, so don't retry.
 * - `failed`: 5xx, network error, timeout or unexpected response. Worth retrying.
 */
export type HiscoreResult = { status: 'found'; hiscore: JsonResponse } | { status: 'notFound' } | { status: 'failed' };

export async function getHiscore(agent: Agent, username: string): Promise<HiscoreResult> {
  const hiscoreUrl = process.env.OSRS_API_BASE_URL + `/m=hiscore_oldschool/index_lite.json?player=${username}`;

  try {
    const response = await fetch(hiscoreUrl, {
      agent,
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(HISCORE_FETCH_TIMEOUT_MS),
    });

    if (response.status === 404) {
      console.log(`Not on the hiscores (HTTP 404), skipping without retry: ${username}`);
      return { status: 'notFound' };
    }

    if (!response.ok) {
      console.log(`HTTP ${response.status} for username: ${username} - ${response.statusText}`);
      return { status: 'failed' };
    }

    const json: JsonResponse = await (response.json() as Promise<JsonResponse>);
    if (!json || json.name !== username) {
      console.log(`Empty response for username: ${username}`);
      return { status: 'failed' };
    }

    return { status: 'found', hiscore: json };
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      console.log(`Timed out after ${HISCORE_FETCH_TIMEOUT_MS}ms for username: ${username}`);
    } else {
      console.error(`Network error for username: ${username}`, error);
    }
    return { status: 'failed' };
  }
}

export function hiscoreJsonToSourceString({ skills, activities }: JsonResponse): string {
  return [
    skills.flatMap((skill) => [skill.rank, skill.level, skill.xp].join(',')),
    activities.flatMap((activity) => [activity.rank, activity.score].join(',')),
  ]
    .flat()
    .join('\n');
}
