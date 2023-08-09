import { HiscoreEntry, Player } from '@osrs-tracker/models';
import { AnyBulkWriteOperation, Collection, Db, MongoClient } from 'mongodb';

/**
 * Short for MongoUtils.
 *
 * Collection of helper functions for MongoDB.
 */
export class MU {
  static db(mongo: MongoClient): Db {
    return mongo.db(process.env.MONGODB_DATABASE!);
  }

  static col(mongo: MongoClient): Collection<Player> {
    return this.db(mongo).collection(process.env.MONGODB_COLLECTION!);
  }

  static hiscoreEntryBulkWriteOp(username: string, hiscoreEntry: HiscoreEntry): AnyBulkWriteOperation<Player> {
    return {
      updateOne: {
        filter: { username },
        hint: { username: 1 },
        update: {
          $push: {
            hiscoreEntries: {
              $each: [hiscoreEntry],
              $position: 0,
            },
          },
        },
      },
    };
  }
}
