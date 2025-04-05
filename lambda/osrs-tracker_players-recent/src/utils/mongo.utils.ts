import { Player } from '@osrs-tracker/models';
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

  static getLastFetchedPlayers(mongo: MongoClient, limit: number): Promise<Player[]> {
    return this.col(mongo)
      .find<Player>(
        {
          lastHiscoreFetch: { $exists: true }, // Ensure lastHiscoreFetch exists
        },
        {
          hint: { lastHiscoreFetch: -1 }, // Use the index on lastHiscoreFetch
          projection: {
            _id: 0,
            username: 1,
            combatLevel: 1,
            diedAsHardcore: 1,
            lastModified: 1,
            status: 1,
            type: 1,
            scrapingOffsets: 1,
            hiscoreEntries: { $slice: 1 },
          } as { [key in keyof Omit<Player, 'hiscoreEntries'>]: 1 },
        },
      )
      .sort({ lastHiscoreFetch: -1 }) // Sort by lastHiscoreFetch in descending order
      .limit(limit)
      .toArray();
  }
}
