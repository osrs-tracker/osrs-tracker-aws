import { Item } from '@osrs-tracker/models';
import { Agent } from 'https';
import fetch from 'node-fetch';

type ItemPage = {
  letter: string;
  page: number;
};

export class ItemResponse extends Item {
  type?: string;
  typeIcon?: string;
}

export async function fetchItemsFromPage(agent: Agent, { letter, page }: ItemPage): Promise<Item[]> {
  const itemPageResponse = await fetch(
    process.env.OSRS_API_BASE_URL +
      `/m=itemdb_oldschool/api/catalogue/items.json?category=1&alpha=${encodeURIComponent(letter)}&page=${page}`,
    { agent, headers: { 'cache-control': 'no-cache' } },
  ).then((res) => res.json());

  return (itemPageResponse as { items: ItemResponse[] }).items.map(({ type, typeIcon, ...item }) => item);
}
