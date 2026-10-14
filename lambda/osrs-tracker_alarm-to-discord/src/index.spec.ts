import { Context, SNSEvent } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logDryRun } from '@lambda/shared/dry-run.utils';
import { AlarmNotification } from './utils/alarm.utils';
import { handler } from './index';

// DRY_RUN is read once at import; the getter lets a test turn it on
const dryRun = vi.hoisted(() => ({ on: false }));
vi.mock('@lambda/shared/dry-run.utils', () => ({
  get DRY_RUN() {
    return dryRun.on;
  },
  logDryRun: vi.fn(),
}));

const context = {
  functionName: 'osrs-tracker_alarm-to-discord',
  invokedFunctionArn: 'arn:aws:lambda:eu-central-1:000000000000:function:osrs-tracker_alarm-to-discord',
  logStreamName: 'test-stream',
} as Context;

const alarm: AlarmNotification = {
  AlarmName: 'osrs-tracker_refresh-items-errors',
  NewStateValue: 'ALARM',
  OldStateValue: 'OK',
  NewStateReason: 'Threshold Crossed: 1 out of the last 1 datapoints [1.0 (14/10/26 10:00:00)]',
  Trigger: { Dimensions: [{ value: 'osrs-tracker_refresh-items', name: 'FunctionName' }] },
};

/** An SNS event with one record per message. */
const snsEvent = (...messages: string[]) =>
  ({ Records: messages.map((Message) => ({ Sns: { Message } })) }) as unknown as SNSEvent;

const fetchMock = vi.fn<typeof fetch>();

/** The embed of the `n`th alert sent. */
const sentEmbed = (n = 0) => JSON.parse(fetchMock.mock.calls[n][1]!.body as string).embeds[0];

beforeEach(() => {
  dryRun.on = false;
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('handler', () => {
  it('posts an alarm as a red alert linking to the alarmed function', async () => {
    await handler(snsEvent(JSON.stringify(alarm)), context);

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://discord.invalid/webhook', expect.anything());
    expect(sentEmbed()).toMatchObject({
      title: 'Alarm: osrs-tracker_refresh-items-errors',
      description: alarm.NewStateReason,
      color: 0xff0000,
      author: { name: 'osrs-tracker_refresh-items' },
    });
    expect(sentEmbed().url).toContain('log-group/$252Faws$252Flambda$252Fosrs-tracker_refresh-items');
    expect(sentEmbed().author.url).toContain('#/functions/osrs-tracker_refresh-items?tab=monitoring');
  });

  it('posts a recovery in green and skips other changes', async () => {
    const recovered = { ...alarm, OldStateValue: 'ALARM', NewStateValue: 'OK' };
    const created = { ...alarm, OldStateValue: 'INSUFFICIENT_DATA', NewStateValue: 'OK' };

    await handler(snsEvent(JSON.stringify(created), JSON.stringify(recovered)), context);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(sentEmbed()).toMatchObject({ title: 'Recovered: osrs-tracker_refresh-items-errors', color: 0x00ff00 });
    expect(console.info).toHaveBeenCalledWith('Skipped osrs-tracker_refresh-items-errors: INSUFFICIENT_DATA -> OK');
  });

  it('rejects a message that is not an alarm, so Lambda retries it', async () => {
    await expect(handler(snsEvent('{"default":"test"}'), context)).rejects.toThrow(
      'Not a CloudWatch alarm notification',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when Discord cannot be reached, so Lambda retries it', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(handler(snsEvent(JSON.stringify(alarm)), context)).rejects.toThrow('fetch failed');
  });

  it('only logs the alert with DRY_RUN', async () => {
    dryRun.on = true;

    await handler(snsEvent(JSON.stringify(alarm)), context);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logDryRun).toHaveBeenCalledWith(
      'send Discord alert',
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: 'Alarm: osrs-tracker_refresh-items-errors' })],
      }),
    );
  });
});
