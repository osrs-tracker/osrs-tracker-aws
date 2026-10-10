import { Item } from '@osrs-tracker/models';
import { MongoClient } from 'mongodb';
import { DRY_RUN, logDryRun } from '@lambda/shared/dry-run.utils';
import { mongoUtils } from '@lambda/shared/mongo.utils';

/**
 * More items missing from the Wiki's list than this in one run means its response is truncated or broken, not that Jagex
 * removed them from the GE (19 had piled up on 2026-10-10): the delete is skipped then.
 */
export const MAX_REMOVED_ITEMS = 50;

/**
 * Short for MongoUtils.
 *
 * This Lambda's MongoDB queries and writes, on top of the shared client and collection.
 */
export class MU extends mongoUtils() {
  static async upsertItems(mongo: MongoClient, item: Item[]): Promise<number> {
    if (DRY_RUN) {
      logDryRun(`upsert ${item.length} items, e.g.`, item.slice(0, 3));
      return item.length;
    }

    return MU.col(mongo)
      .bulkWrite(
        item.map((item) => ({
          updateOne: {
            filter: { id: item.id },
            hint: { id: 1 },
            update: { $set: item },
            upsert: true,
          },
        })),
      )
      .then(({ matchedCount, upsertedCount }) => (matchedCount || 0) + (upsertedCount || 0));
  }

  /**
   * Deletes the items whose `id` isn't in `ids` (the Wiki's current list): items no longer on the GE. Skipped, with a
   * warning, when more than `MAX_REMOVED_ITEMS` would go, so a bad response never wipes the collection.
   */
  static async removeItemsNotIn(mongo: MongoClient, ids: number[]): Promise<number> {
    const filter = { id: { $nin: ids } };
    const removable = await MU.col(mongo).countDocuments(filter, { hint: { id: 1 } });

    if (removable > MAX_REMOVED_ITEMS) {
      console.warn(`Skipped removing ${removable} items missing from the Wiki's list: more than ${MAX_REMOVED_ITEMS}.`);
      return 0;
    }
    if (removable === 0) return 0;

    if (DRY_RUN) {
      const removed = await MU.col(mongo)
        .find(filter, { hint: { id: 1 }, projection: { _id: 0, id: 1, name: 1 } })
        .toArray();
      logDryRun(`remove ${removable} items missing from the Wiki's list`, removed);
      return removable;
    }

    const { deletedCount } = await MU.col(mongo).deleteMany(filter, { hint: { id: 1 } });
    return deletedCount;
  }
}
