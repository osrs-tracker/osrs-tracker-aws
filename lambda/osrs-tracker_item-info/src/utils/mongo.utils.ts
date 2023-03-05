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

  static getItem(mongo: MongoClient, id: number): Promise<Item | null> {
    return this.col(mongo).findOne<Item>({ id: id }, { hint: { id: 1 }, projection: { _id: 0 } });
  }
}
