import { Item } from '@osrs-tracker/models';
import { Agent } from 'https';
import fetch from 'node-fetch';

export async function fetchItems(agent: Agent): Promise<Item[]> {
  const itemResponse = await fetch('https://prices.runescape.wiki/api/v1/osrs/mapping', {
    agent,
    headers: {
      'cache-control': 'no-cache',
      'user-agent': 'github:osrs-tracker/osrs-tracker-aws', // https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices#Please_set_a_descriptive_User-Agent!
    },
  });

  return itemResponse.json() as Promise<Item[]>;
}
