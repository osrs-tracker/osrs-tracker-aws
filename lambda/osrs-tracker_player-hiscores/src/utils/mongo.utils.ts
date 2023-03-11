import { HiscoreEntry, PlayerWithHiscores } from '@osrs-tracker/models';
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

  static async getPlayerHiscores(
    mongo: MongoClient,
    username: string,
    scrapingOffset: number,
    skip: number,
  ): Promise<HiscoreEntry[] | null> {
    const player = await this.col(mongo).findOne<PlayerWithHiscores>(
      { 'username': username, 'hiscoreEntries.scrapingOffset': scrapingOffset },
      {
        hint: { 'username': 1, 'hiscoreEntries.scrapingOffset': 1 },
        projection: { _id: 0, username: 1, hiscoreEntries: { $slice: [skip, 7] } },
      },
    );

    return player?.hiscoreEntries ?? null;
  }
}
