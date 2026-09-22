import { HiscoreActivity, HiscoreSkill } from '@osrs-tracker/models';
import { Agent } from 'https';
import fetch from 'node-fetch';

type JsonResponse = {
  name: string;
  skills: HiscoreSkill[];
  activities: HiscoreActivity[];
};

export async function getHiscore(agent: Agent, username: string): Promise<JsonResponse | null> {
  const hiscoreUrl = process.env.OSRS_API_BASE_URL + `/m=hiscore_oldschool/index_lite.json?player=${username}`;

  try {
    const response = await fetch(hiscoreUrl, { agent, headers: { 'cache-control': 'no-cache' } });

    if (!response.ok) {
      console.log(`HTTP ${response.status} for username: ${username} - ${response.statusText}`);
      return null;
    }

    const json: JsonResponse = await (response.json() as Promise<JsonResponse>);
    if (!json || json.name !== username) {
      console.log(`Empty response for username: ${username}`);
      return null;
    }

    return json;
  } catch (error) {
    console.error(`Network error for username: ${username}`, error);
    return null;
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
