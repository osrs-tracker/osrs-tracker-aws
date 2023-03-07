import { Item } from '@osrs-tracker/models';
import { Collection, Db, MongoClient } from 'mongodb';

/**
 * Short for MongoUtils.
 *
 * Collection of helper functions for MongoDB.
 */
export class MU {
  static db(mongo: MongoClient): Db {
    return mongo.db(process.env.MONGODB_DATABASE!);
  }

  static col(mongo: MongoClient): Collection {
    return this.db(mongo).collection(process.env.MONGODB_COLLECTION!);
  }

  static upsertItems(mongo: MongoClient, itemResponse: Item[]): Promise<number> {
    return MU.col(mongo)
      .bulkWrite(
        itemResponse.map((item) => ({
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
