import { describe, expect, it } from 'vitest';
import { alarmAlert, AlarmNotification, parseAlarm } from './alarm.utils';

const alarm = (change: Partial<AlarmNotification>): AlarmNotification => ({
  AlarmName: 'osrs-tracker_refresh-items-errors',
  AlarmArn: 'arn:aws:cloudwatch:eu-central-1:000000000000:alarm:osrs-tracker_refresh-items-errors',
  NewStateValue: 'ALARM',
  OldStateValue: 'OK',
  AlarmDescription: 'osrs-tracker_refresh-items failed (error, timeout or out of memory): read its latest log stream',
  NewStateReason: 'Threshold Crossed',
  Trigger: {
    Dimensions: [{ value: 'osrs-tracker_refresh-items', name: 'FunctionName' }],
    Period: 3600,
    EvaluationPeriods: 1,
  },
  ...change,
});

describe('parseAlarm', () => {
  it('parses an alarm notification', () => {
    expect(parseAlarm(JSON.stringify(alarm({})))).toEqual(alarm({}));
  });

  it.each([
    ['a message without an alarm name', JSON.stringify({ NewStateValue: 'ALARM' })],
    ['a message without a state', JSON.stringify({ AlarmName: 'osrs-tracker_refresh-items-errors' })],
  ])('rejects %s', (_, message) => {
    expect(() => parseAlarm(message)).toThrow('Not a CloudWatch alarm notification');
  });

  it('rejects a message that is not JSON', () => {
    expect(() => parseAlarm('test')).toThrow(SyntaxError);
  });
});

describe('alarmAlert', () => {
  it('turns an ALARM into a red alert about the alarmed function, with its description and the reason', () => {
    expect(alarmAlert(alarm({}))).toEqual({
      title: 'Alarm: osrs-tracker_refresh-items-errors',
      description:
        'osrs-tracker_refresh-items failed (error, timeout or out of memory): read its latest log stream\n\nThreshold Crossed',
      color: 0xff0000,
      functionName: 'osrs-tracker_refresh-items',
    });
  });

  it('gives only the reason for an alarm without a description', () => {
    expect(alarmAlert(alarm({ AlarmDescription: null }))?.description).toBe('Threshold Crossed');
  });

  it('turns ALARM -> OK into a green recovery', () => {
    expect(alarmAlert(alarm({ NewStateValue: 'OK', OldStateValue: 'ALARM' }))).toEqual({
      title: 'Recovered: osrs-tracker_refresh-items-errors',
      description: 'Back to normal: no threshold crossed for 1 hour.',
      color: 0x00ff00,
      functionName: 'osrs-tracker_refresh-items',
    });
  });

  it.each([
    [600, 1, '10 minutes'],
    [300, 1, '5 minutes'],
    [86_400, 1, '1 day'],
    [3_600, 2, '2 hours'],
  ])('says a %i s period over %i evaluations is %s', (Period, EvaluationPeriods, text) => {
    const recovered = alarm({ NewStateValue: 'OK', OldStateValue: 'ALARM', Trigger: { Period, EvaluationPeriods } });

    expect(alarmAlert(recovered)?.description).toBe(`Back to normal: no threshold crossed for ${text}.`);
  });

  it('gives the reason for a recovery without a period (a metric-math alarm)', () => {
    const recovered = alarm({ NewStateValue: 'OK', OldStateValue: 'ALARM', Trigger: {} });

    expect(alarmAlert(recovered)?.description).toBe('Threshold Crossed');
  });

  it.each([
    ['INSUFFICIENT_DATA', 'OK'],
    ['OK', 'INSUFFICIENT_DATA'],
    ['ALARM', 'INSUFFICIENT_DATA'],
  ] as const)('skips %s -> %s', (OldStateValue, NewStateValue) => {
    expect(alarmAlert(alarm({ OldStateValue, NewStateValue }))).toBeUndefined();
  });

  it('links an alarm on anything but a Lambda to the alarm itself', () => {
    const proxyAlarm = alarm({
      AlarmName: 'osrs-tracker_hiscore-proxy-requests',
      AlarmArn: 'arn:aws:cloudwatch:eu-central-1:000000000000:alarm:osrs-tracker_hiscore-proxy-requests',
      AlarmDescription: 'The hiscore proxy got 1,500+ requests in 5 minutes',
      Trigger: { Dimensions: [{ value: 'api-id', name: 'ApiId' }], Period: 300 },
    });

    expect(alarmAlert(proxyAlarm)).toEqual({
      title: 'Alarm: osrs-tracker_hiscore-proxy-requests',
      description: 'The hiscore proxy got 1,500+ requests in 5 minutes\n\nThreshold Crossed',
      color: 0xff0000,
      url: 'https://console.aws.amazon.com/cloudwatch/home?region=eu-central-1#alarmsV2:alarm/osrs-tracker_hiscore-proxy-requests',
    });
  });
});
