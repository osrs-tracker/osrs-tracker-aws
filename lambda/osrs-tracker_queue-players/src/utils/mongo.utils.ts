import { Player } from '@osrs-tracker/models';
import { FindCursor, MongoClient } from 'mongodb';
import { mongoUtils } from '@lambda/shared/mongo.utils';

/**
 * Short for MongoUtils.
 *
 * This Lambda's MongoDB queries and writes, on top of the shared client and collection.
 */
export class MU extends mongoUtils() {
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
