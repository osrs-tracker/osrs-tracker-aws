import { PlayerWithHiscores } from '@osrs-tracker/models';
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

  static col(mongo: MongoClient): Collection<PlayerWithHiscores> {
    return this.db(mongo).collection(process.env.MONGODB_COLLECTION!);
  }
}
