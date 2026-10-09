import { Context, ScheduledEvent } from 'aws-lambda';
import { fetchItems } from './utils/item.utils';
import { MU } from './utils/mongo.utils';
// validates the environment at cold start (only the shared variables)
import './env';

const client = MU.client();

export const handler = async (_event: ScheduledEvent, context: Context) => {
  const startFetching = performance.now();

  const items = await fetchItems();

  console.info(`Fetched ${items.length} items in ${Math.trunc(performance.now() - startFetching)}ms.`);

  const startUpserting = performance.now();

  const upsertedItemCount = await MU.upsertItems(client, items);

  console.info(`Upserted ${upsertedItemCount} items in ${Math.trunc(performance.now() - startUpserting)}ms.`);

  if (upsertedItemCount === 0) throw Error('No items processed');

  return context.logStreamName;
};
