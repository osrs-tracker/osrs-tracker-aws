import { Item } from '@osrs-tracker/models';
import { AuthMechanism, Collection, Db, MongoClient, MongoClientOptions } from 'mongodb';
import { DRY_RUN, logDryRun } from './dry-run.utils';
import { env } from '../env';

/**
 * Short for MongoUtils.
 *
 * Collection of helper functions for MongoDB.
 */
export class MU {
  /**
   * Creates the MongoClient. Locally (`MONGODB_USERNAME` set) it authenticates with SCRAM using an Atlas database user;
   * in production with MONGODB-AWS, using the role credentials from the AWS SDK credential chain.
   */
  static client(options: MongoClientOptions = {}): MongoClient {
    return new MongoClient(env.MONGODB_URI, {
      ...options,
      ...(env.MONGODB_USERNAME
        ? { auth: { username: env.MONGODB_USERNAME, password: env.MONGODB_PASSWORD } }
        : { authMechanism: AuthMechanism.MONGODB_AWS, authSource: '$external' }),
    });
  }

  static db(mongo: MongoClient): Db {
    return mongo.db(env.MONGODB_DATABASE);
  }

  static col(mongo: MongoClient): Collection {
    return this.db(mongo).collection(env.MONGODB_COLLECTION);
  }

  static async upsertItems(mongo: MongoClient, item: Item[]): Promise<number> {
    if (DRY_RUN) {
      logDryRun(`upsert ${item.length} items, e.g.`, item.slice(0, 3));
      return item.length;
    }

    return MU.col(mongo)
      .bulkWrite(
        item.map((item) => ({
          updateOne: {
            filter: { id: item.id },
            hint: { id: 1 },
            update: { $set: item },
            upsert: true,
          },
        })),
      )
      .then(({ matchedCount, upsertedCount }) => (matchedCount || 0) + (upsertedCount || 0));
  }
}
