import { Agent } from 'https';
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';
import { ItemPage, ItemResponse } from '../models/item.model';
import { MU } from './mongo.utils';

export async function processItems(mongo: MongoClient, agent: Agent, itemPage: ItemPage): Promise<number> {
  const items = await fetchItems(agent, itemPage);

  const bulkWrite = await MU.col(mongo).bulkWrite(
    items.map((item) => ({
      updateOne: {
        filter: { id: item.id },
        hint: { id: 1 },
        update: { $set: item },
        upsert: true,
      },
    })),
  );

  return (bulkWrite.matchedCount || 0) + (bulkWrite.upsertedCount || 0);
}

async function fetchItems(agent: Agent, { letter, page }: ItemPage): Promise<ItemResponse[]> {
  const itemPageResponse = await fetch(
    process.env.OSRS_API_BASE_URL +
      `/m=itemdb_oldschool/api/catalogue/items.json?category=1&alpha=${encodeURIComponent(letter)}&page=${page}`,
    { agent, headers: { 'cache-control': 'no-cache' } },
  ).then((res) => res.json());

  return (itemPageResponse as { items: ItemResponse[] }).items.map(({ type, typeIcon, ...item }) => item);
}
