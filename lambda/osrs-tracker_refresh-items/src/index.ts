import { Context, ScheduledEvent } from 'aws-lambda';
import { fetchItems } from './utils/item.utils';
import { MU } from './utils/mongo.utils';

const client = MU.client();

export const handler = async (_event: ScheduledEvent, context: Context) => {
  const startFetching = process.hrtime();

  const items = await fetchItems();

  console.info(
    `Fetched ${items.length} items in ${Math.trunc(
      process.hrtime(startFetching)[0] * 1000 + process.hrtime(startFetching)[1] / 1000000,
    )}ms.`,
  );

  const startUpserting = process.hrtime();

  const upsertedItemCount = await MU.upsertItems(client, items);

  console.info(
    `Upserted ${upsertedItemCount} items in ${Math.trunc(
      process.hrtime(startUpserting)[0] * 1000 + process.hrtime(startUpserting)[1] / 1000000,
    )}ms.`,
  );

  if (upsertedItemCount === 0) throw Error('No items processed');

  return context.logStreamName;
};
