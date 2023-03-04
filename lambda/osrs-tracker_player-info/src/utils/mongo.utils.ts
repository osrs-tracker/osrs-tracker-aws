import { Collection, Db, MongoClient, UpdateResult } from 'mongodb';
import { Player } from '../models/player.model';

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

  static getPlayer(mongo: MongoClient, username: string): Promise<Player | null> {
    return this.col(mongo).findOne<Player>({ username: username }, { hint: { username: 1 }, projection: { _id: 0 } });
  }

  static upsertPlayer(mongo: MongoClient, player: Player): Promise<UpdateResult> {
    return this.col(mongo).updateOne(
      { username: player.username },
      { $set: player },
      {
        upsert: true,
        hint: { username: 1 },
      },
    );
  }
}
