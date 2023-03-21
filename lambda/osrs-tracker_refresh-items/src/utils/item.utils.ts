import { Item, LatestPrice } from '@osrs-tracker/models';
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

export async function fetchLatest(agent: Agent): Promise<{ [key: string]: LatestPrice }> {
  const itemResponse = await fetch('https://prices.runescape.wiki/api/v1/osrs/latest', {
    agent,
    headers: {
      'cache-control': 'no-cache',
      'user-agent': 'github:osrs-tracker/osrs-tracker-aws', // https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices#Please_set_a_descriptive_User-Agent!
    },
  }).then((res) => res.json());

  return (itemResponse as { data: { [key: string]: LatestPrice } }).data;
}
