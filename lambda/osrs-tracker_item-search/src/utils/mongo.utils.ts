import { Collection, Db, MongoClient } from 'mongodb';
import { Item } from '../models/item.model';

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
      .aggregate<Item>([
        { $search: { index: 'default', text: { query: query, path: 'name' } } },
        { $addFields: { score: { $meta: 'searchScore' } } },
        { $project: { _id: 0, description: 0, members: 0, today: 0, current: 0, icon_large: 0 } },
        { $limit: 20 },
      ])
      .toArray();
  }
}
