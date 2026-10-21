import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeAsync } from './lambda.utils';

describe('invokeAsync', () => {
  const payload = { usernames: ['alice'], scrapingOffset: 3 };
  const send = vi.fn();
  const client = { send } as unknown as LambdaClient;

  beforeEach(() => {
    send.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('queues the payload as an async event and returns true when Lambda accepts it', async () => {
    send.mockResolvedValue({ StatusCode: 202 });

    expect(await invokeAsync(client, 'osrs-tracker_process-players', payload)).toBe(true);
    expect(send).toHaveBeenCalledExactlyOnceWith(expect.any(InvokeCommand));
    expect(send.mock.calls[0][0].input).toEqual({
      FunctionName: 'osrs-tracker_process-players',
      InvocationType: 'Event',
      Payload: JSON.stringify(payload),
    });
  });

  it('never rejects: returns false and logs when the call fails', async () => {
    const error = new Error('Rate exceeded');
    send.mockRejectedValue(error);

    expect(await invokeAsync(client, 'osrs-tracker_process-players', payload)).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Failed to invoke osrs-tracker_process-players', { payload, error });
  });
});
