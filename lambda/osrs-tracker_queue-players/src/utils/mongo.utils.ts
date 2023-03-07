import { Player } from '@osrs-tracker/models';
import { Collection, Db, FindCursor, MongoClient } from 'mongodb';

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

  /** Returns all usernames that match the scrapingOffset */
  static getAllUsernamesForOffset(mongo: MongoClient, scrapingOffset: number): FindCursor<string> {
    const offsets = [scrapingOffset];
    if (scrapingOffset === -12) offsets.push(12); // same time

    return this.col(mongo)
      .find<Player>(
        { scrapingOffsets: { $in: offsets } },
        {
          hint: { scrapingOffsets: 1 },
          projection: { _id: 0, username: 1 },
        },
      )
      .map((p) => p.username);
  }
}
