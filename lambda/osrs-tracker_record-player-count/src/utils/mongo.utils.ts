import { PlayerCount } from '@osrs-tracker/models';
import { MongoClient } from 'mongodb';
import { DRY_RUN, logDryRun } from '@lambda/shared/dry-run.utils';
import { mongoUtils } from '@lambda/shared/mongo.utils';

/**
 * Short for MongoUtils.
 *
 * This Lambda's MongoDB writes, on top of the shared client and collection (`playerCounts`).
 */
export class MU extends mongoUtils<PlayerCount>() {
  static async insertPlayerCount(mongo: MongoClient, playerCount: PlayerCount): Promise<void> {
    if (DRY_RUN) return logDryRun('insert player count', playerCount);

    await MU.col(mongo).insertOne(playerCount);
  }
}
