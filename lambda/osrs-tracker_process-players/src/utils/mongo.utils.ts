import { HiscoreEntry, Player } from '@osrs-tracker/models';
import {
  AnyBulkWriteOperation,
  AuthMechanism,
  Collection,
  CreateIndexesOptions,
  Db,
  IndexSpecification,
  MongoClient,
  MongoClientOptions,
} from 'mongodb';
import { DRY_RUN, logDryRun } from './dry-run.utils';

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
    return new MongoClient(process.env.MONGODB_URI!, {
      ...options,
      ...(process.env.MONGODB_USERNAME
        ? { auth: { username: process.env.MONGODB_USERNAME, password: process.env.MONGODB_PASSWORD } }
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
    return mongo.db(process.env.MONGODB_DATABASE!);
  }

  static col(mongo: MongoClient): Collection<Player> {
    return this.db(mongo).collection(process.env.MONGODB_COLLECTION!);
  }

  static hiscoreEntryBulkWriteOp(username: string, hiscoreEntry: HiscoreEntry): AnyBulkWriteOperation<Player> {
    return {
      // add new hiscoreEntry to player.hiscoreEntries
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

  /** Executes the bulk write and returns the number of modified players. Logged instead when `DRY_RUN` is set. */
  static async bulkWrite(mongo: MongoClient, operations: AnyBulkWriteOperation<Player>[]): Promise<number> {
    if (DRY_RUN) {
      logDryRun(`push a hiscore entry for ${operations.length} players`, operations);
      return operations.length;
    }

    const { modifiedCount } = await this.col(mongo).bulkWrite(operations);
    return modifiedCount;
  }
}
