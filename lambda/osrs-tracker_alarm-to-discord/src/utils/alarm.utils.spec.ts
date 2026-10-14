import { describe, expect, it } from 'vitest';
import { alarmAlert, AlarmNotification, parseAlarm } from './alarm.utils';

const alarm = (change: Partial<AlarmNotification>): AlarmNotification => ({
  AlarmName: 'osrs-tracker_refresh-items-errors',
  NewStateValue: 'ALARM',
  OldStateValue: 'OK',
  NewStateReason: 'Threshold Crossed',
  Trigger: { Dimensions: [{ value: 'osrs-tracker_refresh-items', name: 'FunctionName' }] },
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
  it('turns an ALARM into a red alert about the alarmed function', () => {
    expect(alarmAlert(alarm({}))).toEqual({
      title: 'Alarm: osrs-tracker_refresh-items-errors',
      description: 'Threshold Crossed',
      color: 0xff0000,
      functionName: 'osrs-tracker_refresh-items',
    });
  });

  it('turns ALARM -> OK into a green recovery', () => {
    expect(alarmAlert(alarm({ NewStateValue: 'OK', OldStateValue: 'ALARM' }))).toMatchObject({
      title: 'Recovered: osrs-tracker_refresh-items-errors',
      color: 0x00ff00,
      functionName: 'osrs-tracker_refresh-items',
    });
  });

  it.each([
    ['INSUFFICIENT_DATA', 'OK'],
    ['OK', 'INSUFFICIENT_DATA'],
    ['ALARM', 'INSUFFICIENT_DATA'],
  ] as const)('skips %s -> %s', (OldStateValue, NewStateValue) => {
    expect(alarmAlert(alarm({ OldStateValue, NewStateValue }))).toBeUndefined();
  });

  it('leaves the function out for an alarm without a FunctionName dimension', () => {
    expect(alarmAlert(alarm({ Trigger: {} }))?.functionName).toBeUndefined();
  });
});
