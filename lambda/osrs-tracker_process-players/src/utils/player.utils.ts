import { Agent } from 'https';
import fetch from 'node-fetch';

export async function getHiscore(agent: Agent, username: string): Promise<string | null> {
  const hiscoreUrl = process.env.OSRS_API_BASE_URL + `/m=hiscore_oldschool/index_lite.ws?player=${username}`;

  try {
    const response = await fetch(hiscoreUrl, { agent, headers: { 'cache-control': 'no-cache' } });

    if (!response.ok) {
      console.log(`HTTP ${response.status} for username: ${username} - ${response.statusText}`);
      return null;
    }

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      console.log(`Empty response for username: ${username}`);
      return null;
    }

    return text;
  } catch (error) {
    console.error(`Network error for username: ${username}`, error);
    return null;
  }
}
