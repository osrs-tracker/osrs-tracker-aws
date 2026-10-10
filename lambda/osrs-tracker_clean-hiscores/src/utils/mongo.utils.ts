import { StoredPlayer } from '@osrs-tracker/models';
import { subDays } from 'date-fns';
import { MongoClient } from 'mongodb';
import { DRY_RUN, logDryRun } from '@lambda/shared/dry-run.utils';
import { mongoUtils } from '@lambda/shared/mongo.utils';

/**
 * Short for MongoUtils.
 *
 * This Lambda's MongoDB queries and writes, on top of the shared client and collection.
 */
export class MU extends mongoUtils<StoredPlayer>() {
  /**
   * Drops the scraping offsets (active or paused) nobody looked up since `cutoff`, together with all their hiscore
   * entries, but always keeps the most recently looked up one. An offset without a lookup date gets `now`, so offsets
   * from before osrs-tracker-api recorded lookups (or merged back from a pause) count from their first run here.
   * Returns the players that lost offsets; when `DRY_RUN` is set it only logs them.
   */
  static async dropUnusedScrapingOffsets(
    mongo: MongoClient,
    cutoff: Date,
    now: Date,
  ): Promise<{ username: string; dropped: number[] }[]> {
    const offsets = { $setUnion: [{ $ifNull: ['$scrapingOffsets', []] }, { $ifNull: ['$pausedScrapingOffsets', []] }] };
    const lookupOf = (offset: unknown) => ({
      $getField: { field: { $toString: offset }, input: { $ifNull: ['$scrapingOffsetLookups', {}] } },
    });
    const keepFilter = (field: string) => ({
      $cond: [{ $isArray: field }, { $filter: { input: field, cond: { $in: ['$$this', '$_keep.o'] } } }, '$$REMOVE'],
    });

    const filter = {
      $or: [{ 'scrapingOffsets.0': { $exists: true } }, { 'pausedScrapingOffsets.0': { $exists: true } }],
    };
    const pipeline = [
      // the lookup date of every offset the player has, `now` when it has none yet
      {
        $set: {
          _lookups: {
            $map: { input: offsets, in: { o: '$$this', d: { $ifNull: [lookupOf('$$this'), now] } } },
          },
        },
      },
      // the offsets looked up since `cutoff`, or else only the most recently looked up one
      {
        $set: {
          _keep: {
            $let: {
              vars: { used: { $filter: { input: '$_lookups', cond: { $gte: ['$$this.d', cutoff] } } } },
              in: {
                $cond: [
                  { $gt: [{ $size: '$$used' }, 0] },
                  '$$used',
                  [{ $first: { $sortArray: { input: '$_lookups', sortBy: { d: -1 } } } }],
                ],
              },
            },
          },
        },
      },
      {
        $set: {
          _dropped: { $setDifference: [offsets, '$_keep.o'] },
          scrapingOffsetLookups: {
            $arrayToObject: { $map: { input: '$_keep', in: { k: { $toString: '$$this.o' }, v: '$$this.d' } } },
          },
        },
      },
      {
        $set: {
          scrapingOffsets: keepFilter('$scrapingOffsets'),
          pausedScrapingOffsets: keepFilter('$pausedScrapingOffsets'),
          hiscoreEntries: {
            $cond: [
              { $isArray: '$hiscoreEntries' },
              { $filter: { input: '$hiscoreEntries', cond: { $not: [{ $in: ['$$this.o', '$_dropped'] }] } } },
              '$$REMOVE',
            ],
          },
        },
      },
    ];

    const dropped = await this.col(mongo)
      .aggregate<{ username: string; dropped: number[] }>([
        { $match: filter },
        ...pipeline,
        { $match: { '_dropped.0': { $exists: true } } },
        { $project: { _id: 0, username: 1, dropped: '$_dropped' } },
      ])
      .toArray();

    if (DRY_RUN) {
      logDryRun(`drop unused scraping offsets and their hiscore entries from ${dropped.length} players`, dropped);
      return dropped;
    }

    await this.col(mongo).updateMany(filter, [...pipeline, { $unset: ['_lookups', '_keep', '_dropped'] }]);
    return dropped;
  }

  /**
   * Removes hiscore entries older than `date` and returns the number of modified players. When `DRY_RUN` is set it only
   * counts the players that would be modified.
   */
  static async pullHiscoreEntriesBefore(mongo: MongoClient, date: Date): Promise<number> {
    if (DRY_RUN) {
      const count = await this.col(mongo).countDocuments({ 'hiscoreEntries.d': { $lt: date } });
      logDryRun(`pull hiscore entries older than ${date.toISOString()} from ${count} players`);
      return count;
    }

    const { modifiedCount } = await this.col(mongo).updateMany({}, { $pull: { hiscoreEntries: { d: { $lt: date } } } });
    return modifiedCount;
  }

  /**
   * Deletes the hiscore layouts no entry uses and returns how many. Layouts from the last day are kept: a writer stores
   * a layout before the first entry that uses it. When `DRY_RUN` is set it only logs the ids it would delete.
   */
  static async deleteUnusedHiscoreLayouts(mongo: MongoClient, now: Date): Promise<number> {
    const used = await this.col(mongo).distinct('hiscoreEntries.l');
    const filter = { _id: { $nin: used }, since: { $lt: subDays(now, 1) } };

    if (DRY_RUN) {
      const ids = await this.layouts(mongo)
        .find(filter, { projection: { _id: 1 } })
        .map(({ _id }) => _id)
        .toArray();
      logDryRun(`delete ${ids.length} unused hiscore layouts`, ids);
      return ids.length;
    }

    const { deletedCount } = await this.layouts(mongo).deleteMany(filter);
    return deletedCount;
  }

  /**
   * Deletes the players without hiscore entries (none left after the pull, or never any) and returns how many. A lookup
   * through the API creates the player again, with its first entry. When `DRY_RUN` is set it only logs who it would
   * delete.
   */
  static async deletePlayersWithoutEntries(mongo: MongoClient): Promise<number> {
    const filter = { $or: [{ hiscoreEntries: { $exists: false } }, { hiscoreEntries: { $size: 0 } }] };

    if (DRY_RUN) {
      const usernames = await this.col(mongo)
        .find(filter, { projection: { _id: 0, username: 1 } })
        .map(({ username }) => username)
        .toArray();
      logDryRun(`delete ${usernames.length} players without hiscore entries`, usernames);
      return usernames.length;
    }

    const { deletedCount } = await this.col(mongo).deleteMany(filter);
    return deletedCount;
  }
}
