import { Player } from '@osrs-tracker/models';
import { Collection, Db, MongoClient, UpdateResult } from 'mongodb';

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

  static getPlayer(
    mongo: MongoClient,
    username: string,
    scrapingOffset: number,
    includeLatestHiscoreEntry: boolean,
  ): Promise<Player | null> {
    return this.col(mongo).findOne<Player>(
      { username: username },
      {
        hint: { username: 1 },
        projection: {
          _id: 0,
          username: 1,
          combatLevel: 1,
          diedAsHardcore: 1,
          lastModified: 1,
          status: 1,
          type: 1,
          scrapingOffsets: 1,
          ...(includeLatestHiscoreEntry ? { hiscoreEntries: { $elemMatch: { scrapingOffset } } } : {}),
        } as { [key in keyof Omit<Player, 'hiscoreEntries'>]: 1 },
      },
    );
  }

  static upsertPlayer(mongo: MongoClient, player: Player, scrapingOffset: number): Promise<UpdateResult> {
    return this.col(mongo).updateOne(
      { username: player.username },
      { $set: player, $addToSet: { scrapingOffsets: scrapingOffset } },
      {
        upsert: true,
        hint: { username: 1 },
      },
    );
  }
}
