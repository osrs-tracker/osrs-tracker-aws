import { Player } from '@osrs-tracker/models';
import {
  AuthMechanism,
  Collection,
  CreateIndexesOptions,
  Db,
  FindCursor,
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

  static col(mongo: MongoClient): Collection {
    return this.db(mongo).collection(process.env.MONGODB_COLLECTION!);
  }

  /** Returns all usernames that match the scrapingOffset */
  static getAllUsernamesForOffset(mongo: MongoClient, scrapingOffset: number): FindCursor<string> {
    const offsets = [scrapingOffset];
    if (scrapingOffset === -12) offsets.push(12); // same time

    return this.col(mongo)
      .find<Player>(
        { scrapingOffsets: { $in: offsets } },
        {
          hint: { scrapingOffsets: 1 },
          projection: { _id: 0, username: 1 },
        },
      )
      .map((p) => p.username);
  }
}
