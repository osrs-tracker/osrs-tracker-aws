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
}
