import { HiscoreEntry, Player } from '@osrs-tracker/models';
import { subDays } from 'date-fns';
import {
  AnyBulkWriteOperation,
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

/** Scraping is paused when a player hasn't been on the hiscores for this many days in a row. */
export const HISCORE_NOT_FOUND_PAUSE_DAYS = 7;

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
          // the player is on the hiscores (again), so end any "not found" streak
          $unset: { hiscoreNotFoundCount: '', hiscoreNotFoundSince: '' },
        },
      },
    };
  }

  /**
   * Update pipeline for a player that is not on the hiscores: starts or continues the "not found" streak, and once the
   * streak is `HISCORE_NOT_FOUND_PAUSE_DAYS` old, moves `scrapingOffsets` to `pausedScrapingOffsets` so the player is no
   * longer queued. The data is kept, and the API restores the offsets when the player is found again.
   */
  static hiscoreNotFoundPipeline(now: Date): Document[] {
    const pauseBefore = subDays(now, HISCORE_NOT_FOUND_PAUSE_DAYS);
    const shouldPause = {
      $and: [
        { $lte: ['$hiscoreNotFoundSince', pauseBefore] },
        { $gt: [{ $size: { $ifNull: ['$scrapingOffsets', []] } }, 0] },
      ],
    };

    return [
      {
        $set: {
          hiscoreNotFoundSince: { $ifNull: ['$hiscoreNotFoundSince', now] },
          hiscoreNotFoundCount: { $add: [{ $ifNull: ['$hiscoreNotFoundCount', 0] }, 1] },
        },
      },
      {
        $set: {
          pausedScrapingOffsets: {
            $cond: [
              shouldPause,
              { $setUnion: [{ $ifNull: ['$pausedScrapingOffsets', []] }, '$scrapingOffsets'] },
              '$pausedScrapingOffsets',
            ],
          },
          scrapingOffsets: { $cond: [shouldPause, '$$REMOVE', '$scrapingOffsets'] },
        },
      },
    ];
  }

  /**
   * Records that the player is not on the hiscores, and returns true when this call paused its scraping. With `DRY_RUN`
   * the same pipeline runs as a read-only aggregation and the result is logged.
   */
  static async recordHiscoreNotFound(mongo: MongoClient, username: string, now = new Date()): Promise<boolean> {
    const pipeline = this.hiscoreNotFoundPipeline(now);
    const projection = {
      _id: 0,
      username: 1,
      scrapingOffsets: 1,
      pausedScrapingOffsets: 1,
      hiscoreNotFoundCount: 1,
      hiscoreNotFoundSince: 1,
    };

    if (DRY_RUN) {
      const [before, after] = await Promise.all([
        this.col(mongo).findOne({ username }, { projection }),
        this.col(mongo)
          .aggregate([{ $match: { username } }, ...pipeline, { $project: projection }])
          .next(),
      ]);
      logDryRun(`record hiscore not found for ${username}`, { before, after });
      return !!before?.scrapingOffsets?.length && !after?.scrapingOffsets;
    }

    const before = await this.col(mongo).findOneAndUpdate({ username }, pipeline, {
      hint: { username: 1 },
      projection,
      returnDocument: 'before',
    });
    if (!before?.scrapingOffsets?.length || !before.hiscoreNotFoundSince) return false;

    return before.hiscoreNotFoundSince <= subDays(now, HISCORE_NOT_FOUND_PAUSE_DAYS);
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
