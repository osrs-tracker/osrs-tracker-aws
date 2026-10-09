import { Item } from '@osrs-tracker/models';
import { MongoClient } from 'mongodb';
import { DRY_RUN, logDryRun } from '@lambda/shared/dry-run.utils';
import { mongoUtils } from '@lambda/shared/mongo.utils';

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
}
