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

  static getLastFetchedItems(mongo: MongoClient, limit: number): Promise<Item[]> {
    return this.col(mongo)
      .find<Item>(
        {
          lastFetch: { $exists: true }, // Ensure lastFetch exists
        },
        {
          hint: { lastFetch: -1 }, // Use the index on lastFetch
          projection: { _id: 0, id: 1, icon: 1, name: 1 },
        },
      )
      .sort({ lastFetch: -1 }) // Sort by lastFetch in descending order
      .limit(limit)
      .toArray();
  }
}
