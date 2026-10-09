import { Player } from '@osrs-tracker/models';
import { MongoClient } from 'mongodb';
import { DRY_RUN, logDryRun } from '../../../shared/src/dry-run.utils';
import { mongoUtils } from '../../../shared/src/mongo.utils';

/**
 * Short for MongoUtils.
 *
 * This Lambda's MongoDB queries and writes, on top of the shared client, collection and `ensureIndex`.
 */
export class MU extends mongoUtils<Player>() {
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
