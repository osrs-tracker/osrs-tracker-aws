import { Agent } from 'https';
import fetch from 'node-fetch';

export function getHiscore(agent: Agent, username: string): Promise<string | null> {
  const hiscoreUrl = process.env.OSRS_API_BASE_URL + `/m=hiscore_oldschool/index_lite.ws?player=${username}`;

  return fetch(hiscoreUrl, { agent, headers: { 'cache-control': 'no-cache' } }).then(async (res) =>
    res.ok ? res.text() : null,
  );
}
