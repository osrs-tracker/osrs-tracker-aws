import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { DRY_RUN, logDryRun } from './dry-run.utils';

/**
 * Invokes `functionName` asynchronously (`InvocationType: 'Event'`) with `payload` as its event: Lambda queues the event
 * and returns before the function runs, then retries it per the function's async invoke config. Never rejects: returns
 * false, and logs the error, when Lambda didn't accept the event, so process-players can use it after its bulk writes.
 * True without invoking in `DRY_RUN`.
 */
export async function invokeAsync(
  lambdaClient: LambdaClient,
  functionName: string,
  payload: unknown,
): Promise<boolean> {
  if (DRY_RUN) {
    logDryRun(`invoke ${functionName} asynchronously`, payload);
    return true;
  }

  try {
    await lambdaClient.send(
      new InvokeCommand({ FunctionName: functionName, InvocationType: 'Event', Payload: JSON.stringify(payload) }),
    );
    return true;
  } catch (e) {
    console.error(`Failed to invoke ${functionName}`, { payload, error: e });
    return false;
  }
}
