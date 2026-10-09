import { Player } from '@osrs-tracker/models';
import {
  AuthMechanism,
  Collection,
  CreateIndexesOptions,
  Db,
  IndexSpecification,
  MongoClient,
  MongoClientOptions,
} from 'mongodb';
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

  /** Ensures an index exists. Skipped when `DRY_RUN` is set. */
  static async ensureIndex(
    mongo: MongoClient,
    spec: IndexSpecification,
    options: CreateIndexesOptions = {},
  ): Promise<void> {
    if (DRY_RUN) return logDryRun('create index', { spec, options });

    await this.col(mongo).createIndex(spec, options);
  }

  static db(mongo: MongoClient): Db {
    return mongo.db(env.MONGODB_DATABASE);
  }

  static col(mongo: MongoClient): Collection<Player> {
    return this.db(mongo).collection(env.MONGODB_COLLECTION);
  }

  /**
   * Removes hiscore entries older than `date` and returns the number of modified players. When `DRY_RUN` is set it only
   * counts the players that would be modified.
   */
  static async pullHiscoreEntriesBefore(mongo: MongoClient, date: Date): Promise<number> {
    if (DRY_RUN) {
      const count = await this.col(mongo).countDocuments({ 'hiscoreEntries.date': { $lt: date } });
      logDryRun(`pull hiscore entries older than ${date.toISOString()} from ${count} players`);
      return count;
    }

    const { modifiedCount } = await this.col(mongo).updateMany(
      {},
      { $pull: { hiscoreEntries: { date: { $lt: date } } } },
    );
    return modifiedCount;
  }
}
