type AlarmState = 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';

/**
 * The part of a CloudWatch alarm's SNS notification (the record's `Sns.Message`, as JSON) this Lambda reads. A
 * single-metric alarm has its dimensions in `Trigger.Dimensions`, with lowercase `name` and `value`.
 */
export interface AlarmNotification {
  AlarmName: string;
  NewStateValue: AlarmState;
  OldStateValue: AlarmState;
  NewStateReason: string;
  Trigger?: { Dimensions?: { name: string; value: string }[] };
}

/** The Discord alert for an alarm's state change. */
export interface AlarmAlert {
  title: string;
  description: string;
  color: number;
  /**
   * The Lambda the alarm watches, from its `FunctionName` dimension. Undefined for an alarm on another metric, whose links
   * then go to this Lambda.
   */
  functionName?: string;
}

/** Parses an SNS message as a CloudWatch alarm notification; throws on anything else (e.g. a message sent by hand). */
export function parseAlarm(message: string): AlarmNotification {
  const alarm = JSON.parse(message) as Partial<AlarmNotification>;

  if (typeof alarm.AlarmName !== 'string' || typeof alarm.NewStateValue !== 'string')
    throw new Error(`Not a CloudWatch alarm notification: ${message.slice(0, 500)}`);

  return alarm as AlarmNotification;
}

/**
 * The alert for an alarm going into `ALARM` (red) or back from it to `OK` (green), or undefined for any other change: a
 * new alarm's first `OK`, and `INSUFFICIENT_DATA`, which the alarms don't notify on.
 */
export function alarmAlert(alarm: AlarmNotification): AlarmAlert | undefined {
  const functionName = alarm.Trigger?.Dimensions?.find(({ name }) => name === 'FunctionName')?.value;

  if (alarm.NewStateValue === 'ALARM')
    return { title: `Alarm: ${alarm.AlarmName}`, description: alarm.NewStateReason, color: 0xff0000, functionName };

  if (alarm.NewStateValue === 'OK' && alarm.OldStateValue === 'ALARM')
    return { title: `Recovered: ${alarm.AlarmName}`, description: alarm.NewStateReason, color: 0x00ff00, functionName };

  return undefined;
}
