import { Context } from 'aws-lambda/handler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discordAlert, discordAlertNeverRejects } from './discord-alert';
import { USER_AGENT } from './user-agent';

const WEBHOOK_URL = 'https://discord.invalid/webhook';

const context = {
  functionName: 'osrs-tracker_test',
  logStreamName: 'log-stream',
  invokedFunctionArn: 'arn:aws:lambda:eu-central-1:123456789012:function:osrs-tracker_test',
} as Context;

const fetchMock = vi.fn<typeof fetch>();

/** The embed of the one alert sent. */
const sentEmbed = () => JSON.parse(fetchMock.mock.calls[0][1]!.body as string).embeds[0];

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('discordAlert', () => {
  it("posts one red embed linking to the invocation's logs", async () => {
    await discordAlert(WEBHOOK_URL, 'Title', 'Description', context);

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      WEBHOOK_URL,
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'user-agent': USER_AGENT }) }),
    );
    expect(sentEmbed()).toMatchObject({
      title: 'Title',
      description: 'Description',
      author: { name: 'osrs-tracker_test' },
      color: 0xff0000,
    });
    expect(sentEmbed().url).toContain('region=eu-central-1#logEventViewer:group=/aws/lambda/osrs-tracker_test');
    expect(sentEmbed().url).toContain('stream=log-stream');
  });

  it('links to the log group and monitoring tab of the function an alert is about, in its colour', async () => {
    await discordAlert(WEBHOOK_URL, 'Title', 'Description', context, {
      functionName: 'osrs-tracker_other',
      color: 0x00ff00,
    });

    expect(sentEmbed()).toMatchObject({
      author: {
        name: 'osrs-tracker_other',
        url: 'https://console.aws.amazon.com/lambda/home?region=eu-central-1#/functions/osrs-tracker_other?tab=monitoring',
      },
      url: 'https://console.aws.amazon.com/cloudwatch/home?region=eu-central-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fosrs-tracker_other',
      color: 0x00ff00,
    });
  });

  it("truncates a description over Discord's 4096 characters", async () => {
    await discordAlert(WEBHOOK_URL, 'Title', 'x'.repeat(5000), context);

    expect(sentEmbed().description).toBe(`${'x'.repeat(4095)}…`);
  });

  it('keeps a description of exactly 4096 characters', async () => {
    await discordAlert(WEBHOOK_URL, 'Title', 'x'.repeat(4096), context);

    expect(sentEmbed().description).toBe('x'.repeat(4096));
  });

  it('logs a non-2xx response instead of rejecting', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    await expect(discordAlert(WEBHOOK_URL, 'Title', 'Description', context)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith('Failed to send Discord alert: HTTP 404');
  });

  it('rejects when the request fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(discordAlert(WEBHOOK_URL, 'Title', 'Description', context)).rejects.toThrow('fetch failed');
  });

  it('rejects when the request takes over 5 s', async () => {
    // a request that stalls until it's aborted, with the 5 s timeout shortened to 1 ms
    fetchMock.mockImplementation(
      (_, init) =>
        new Promise((_, reject) => init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason))),
    );
    const timeout = AbortSignal.timeout;
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => timeout(1));

    await expect(discordAlert(WEBHOOK_URL, 'Title', 'Description', context)).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    expect(AbortSignal.timeout).toHaveBeenCalledExactlyOnceWith(5_000);
  });
});

describe('discordAlertNeverRejects', () => {
  it('logs a failed request instead of rejecting', async () => {
    const error = new TypeError('fetch failed');
    fetchMock.mockRejectedValue(error);

    await expect(discordAlertNeverRejects(WEBHOOK_URL, 'Title', 'Description', context)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith('Failed to send Discord alert', error);
  });
});
