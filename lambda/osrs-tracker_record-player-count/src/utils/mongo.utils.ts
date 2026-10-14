import { PlayerCount, PlayerCountDay } from '@osrs-tracker/models';
import { Collection, MongoClient } from 'mongodb';
import { DRY_RUN, logDryRun } from '@lambda/shared/dry-run.utils';
import { mongoUtils } from '@lambda/shared/mongo.utils';
import { env } from '../env';
import { playerCountDaysPipeline } from './player-count-days';

/**
 * Short for MongoUtils.
 *
 * This Lambda's MongoDB writes, on top of the shared client and collection (`playerCounts`).
 */
export class MU extends mongoUtils<PlayerCount>() {
  /** The daily averages of the samples (`playerCountsDaily`). */
  static days(mongo: MongoClient): Collection<PlayerCountDay> {
    return this.db(mongo).collection<PlayerCountDay>(env.MONGODB_DAILY_COLLECTION);
  }

  static async insertPlayerCount(mongo: MongoClient, playerCount: PlayerCount): Promise<void> {
    if (DRY_RUN) return logDryRun('insert player count', playerCount);

    await MU.col(mongo).insertOne(playerCount);
  }

  /** The start of the newest day in `playerCountsDaily`, `undefined` when it's empty. */
  static async newestPlayerCountDay(mongo: MongoClient): Promise<Date | undefined> {
    const newest = await MU.days(mongo).findOne({}, { sort: { date: -1 }, projection: { _id: 0, date: 1 } });
    return newest?.date;
  }

  /**
   * Recomputes every day from `from` on (all of them without it) from the samples, replacing the stored days. Needs the
   * unique `{ date: 1 }` index on `playerCountsDaily` (`$merge`'s `on`). When `DRY_RUN` is set it only logs the days.
   */
  static async mergePlayerCountDays(mongo: MongoClient, from?: Date): Promise<void> {
    const pipeline = playerCountDaysPipeline(from);
    if (DRY_RUN) return logDryRun('store daily player counts', await MU.col(mongo).aggregate(pipeline).toArray());

    // `$merge` writes as the cursor is read, and returns no documents
    await MU.col(mongo)
      .aggregate([
        ...pipeline,
        {
          $merge: {
            into: env.MONGODB_DAILY_COLLECTION,
            on: 'date',
            whenMatched: 'replace',
            whenNotMatched: 'insert',
          },
        },
      ])
      .toArray();
  }
}
