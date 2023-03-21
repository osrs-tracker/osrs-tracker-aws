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

  static searchItems(mongo: MongoClient, query: string): Promise<Item[]> {
    return this.col(mongo)
      .find<Item>(
        { $text: { $search: query } },
        { projection: { _id: 0, id: 1, icon: 1, name: 1, score: { $meta: 'textScore' } } },
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20)
      .toArray();
  }
}
