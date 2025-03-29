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

  static getItem(mongo: MongoClient, id: number): Promise<Item | null> {
    return this.col(mongo).findOneAndUpdate(
      { id: id },
      { $set: { lastFetch: new Date() } },
      {
        hint: { id: 1 },
        projection: { _id: 0 },
        returnDocument: 'after', // Important: returns the document after the update
      },
    ) as Promise<Item | null>;
  }
}
