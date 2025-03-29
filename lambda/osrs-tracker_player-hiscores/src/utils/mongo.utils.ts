import { HiscoreEntry, Player } from '@osrs-tracker/models';
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
    size: number,
    skip: number,
  ): Promise<HiscoreEntry[] | null> {
    // First run an update to set the lastFetchedHiscores time
    await this.col(mongo).updateOne({ username: username }, { $set: { lastHiscoreFetch: new Date() } });

    // Retrieve the player's hiscores
    const player = await this.col(mongo)
      .aggregate<Player>([
        { $match: { username: username } },
        {
          $project: {
            _id: 0,
            username: 1,
            hiscoreEntries: {
              $slice: [
                {
                  $filter: {
                    input: '$hiscoreEntries',
                    as: 'entry',
                    cond: { $eq: ['$$entry.scrapingOffset', scrapingOffset] },
                  },
                },
                skip,
                size,
              ],
            },
          },
        },
      ])
      .next();

    return player?.hiscoreEntries ?? null;
  }
}
