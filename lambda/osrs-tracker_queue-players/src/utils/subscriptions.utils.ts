import { DynamoDBDocumentClient, paginateScan } from '@aws-sdk/lib-dynamodb';
import { PlayerSubscription } from '@osrs-tracker/models';

/**
 * Reads the whole subscriptions table (`PlayerSubscription` items, about 520), page by page. The ingester's sync is its
 * only writer: never write to it from here.
 */
export async function scanSubscriptions(
  dynamo: DynamoDBDocumentClient,
  tableName: string,
): Promise<PlayerSubscription[]> {
  const subscriptions: PlayerSubscription[] = [];
  for await (const page of paginateScan({ client: dynamo }, { TableName: tableName }))
    subscriptions.push(...((page.Items ?? []) as PlayerSubscription[]));
  return subscriptions;
}
