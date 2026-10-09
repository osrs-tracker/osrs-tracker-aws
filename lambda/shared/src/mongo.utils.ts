import { env } from '@lambda/env';
import {
  AuthMechanism,
  Collection,
  CreateIndexesOptions,
  Db,
  Document,
  IndexSpecification,
  MongoClient,
  MongoClientOptions,
} from 'mongodb';
import { DRY_RUN, logDryRun } from './dry-run.utils';

/**
 * The MongoDB helpers every Lambda shares, typed with the Lambda's collection schema. A Lambda extends the returned class
 * with its own queries and writes: `export class MU extends mongoUtils<Player>() { … }`.
 */
export function mongoUtils<TSchema extends Document = Document>() {
  return class MongoUtils {
    /**
     * Creates the MongoClient. Locally (`MONGODB_USERNAME` set) it authenticates with SCRAM using an Atlas database
     * user; in production with MONGODB-AWS, using the role credentials from the AWS SDK credential chain.
     */
    static client(options: MongoClientOptions = {}): MongoClient {
      return new MongoClient(env.MONGODB_URI, {
        ...options,
        ...(env.MONGODB_USERNAME
          ? { auth: { username: env.MONGODB_USERNAME, password: env.MONGODB_PASSWORD } }
          : { authMechanism: AuthMechanism.MONGODB_AWS, authSource: '$external' }),
      });
    }

    /** Ensures an index exists on the collection. Skipped when `DRY_RUN` is set. */
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

    static col(mongo: MongoClient): Collection<TSchema> {
      return this.db(mongo).collection<TSchema>(env.MONGODB_COLLECTION);
    }
  };
}
