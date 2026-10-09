import { Item } from '@osrs-tracker/models';

export async function fetchItems(): Promise<Item[]> {
  const itemResponse = await fetch('https://prices.runescape.wiki/api/v1/osrs/mapping', {
    headers: {
      'cache-control': 'no-cache',
      'user-agent': 'github:osrs-tracker/osrs-tracker-aws', // https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices#Please_set_a_descriptive_User-Agent!
    },
    // undici's own timeouts are 300 s; fail a stalled request well within the Lambda's 30 s timeout
    signal: AbortSignal.timeout(15_000),
  });

  if (!itemResponse.ok) throw new Error(`Item mapping request failed: HTTP ${itemResponse.status}`);

  return itemResponse.json() as Promise<Item[]>;
}
