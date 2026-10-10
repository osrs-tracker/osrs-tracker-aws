import { HiscoreLayout, hiscoreEntriesWriteExpression, StoredHiscoreEntry, StoredPlayer } from '@osrs-tracker/models';
import { subDays } from 'date-fns';
import { AnyBulkWriteOperation, Document, MongoClient } from 'mongodb';
import { DRY_RUN, logDryRun } from '@lambda/shared/dry-run.utils';
import { mongoUtils } from '@lambda/shared/mongo.utils';

/** Scraping is paused when a player hasn't been on the hiscores for this many days in a row. */
export const HISCORE_NOT_FOUND_PAUSE_DAYS = 7;

/** Layout ids this warm Lambda has upserted or found with the same names, so each is upserted once per container. */
const knownLayoutIds = new Set<number>();

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

/**
 * Short for MongoUtils.
 *
 * This Lambda's MongoDB queries and writes, on top of the shared client and collection.
 */
export class MU extends mongoUtils<StoredPlayer>() {
  /**
   * Upserts the layouts the new entries use, before the entries are written. Layout ids already known to this warm
   * Lambda are skipped. Throws when an existing layout with the same id has other names (a hash collision), so nothing
   * is stored under a layout that decodes to the wrong names. Logged instead when `DRY_RUN` is set.
   */
  static async ensureHiscoreLayouts(mongo: MongoClient, layouts: HiscoreLayout[]): Promise<void> {
    const unknown = new Map<number, HiscoreLayout>();
    for (const layout of layouts) if (!knownLayoutIds.has(layout._id)) unknown.set(layout._id, layout);

    for (const { _id, skills, activities, since } of unknown.values()) {
      if (DRY_RUN) {
        logDryRun(`upsert hiscore layout ${_id}`, { _id, skills, activities, since });
        continue;
      }

      const { upsertedCount } = await this.layouts(mongo).updateOne(
        { _id },
        { $setOnInsert: { skills, activities, since } },
        { upsert: true },
      );
      if (!upsertedCount) {
        const existing = await this.layouts(mongo).findOne({ _id });
        if (!existing || !sameNames(existing.skills, skills) || !sameNames(existing.activities, activities))
          throw new Error(`Hiscore layout ${_id} is stored with other names (a layout id hash collision)`);
      }
      knownLayoutIds.add(_id);
    }
  }

  static hiscoreEntryBulkWriteOp(username: string, entry: StoredHiscoreEntry): AnyBulkWriteOperation<StoredPlayer> {
    return {
      // prepend the new entry to player.hiscoreEntries and strip the previous one for the same offset
      updateOne: {
        filter: { username },
        hint: { username: 1 },
        update: [
          { $set: { hiscoreEntries: hiscoreEntriesWriteExpression(entry) } },
          // the player is on the hiscores (again), so end any "not found" streak
          { $unset: ['hiscoreNotFoundCount', 'hiscoreNotFoundSince'] },
        ],
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
  static async bulkWrite(mongo: MongoClient, operations: AnyBulkWriteOperation<StoredPlayer>[]): Promise<number> {
    if (DRY_RUN) {
      logDryRun(`prepend a hiscore entry for ${operations.length} players`, operations);
      return operations.length;
    }

    const { modifiedCount } = await this.col(mongo).bulkWrite(operations);
    return modifiedCount;
  }
}
