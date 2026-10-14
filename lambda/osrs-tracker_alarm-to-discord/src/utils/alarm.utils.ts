type AlarmState = 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';

/**
 * The part of a CloudWatch alarm's SNS notification (the record's `Sns.Message`, as JSON) this Lambda reads. A
 * single-metric alarm has its dimensions in `Trigger.Dimensions`, with lowercase `name` and `value`.
 */
export interface AlarmNotification {
  AlarmName: string;
  AlarmArn: string;
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
  /** The Lambda the alarm watches, from its `FunctionName` dimension: the alert links to its logs. */
  functionName?: string;
  /**
   * For an alarm on anything else (the hiscore proxy's request count): the alarm in the CloudWatch console, which the
   * title links to. The author stays this Lambda, the sender.
   */
  url?: string;
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
  const links = functionName ? { functionName } : { url: alarmUrl(alarm) };

  if (alarm.NewStateValue === 'ALARM')
    return { title: `Alarm: ${alarm.AlarmName}`, description: alarm.NewStateReason, color: 0xff0000, ...links };

  if (alarm.NewStateValue === 'OK' && alarm.OldStateValue === 'ALARM')
    return { title: `Recovered: ${alarm.AlarmName}`, description: alarm.NewStateReason, color: 0x00ff00, ...links };

  return undefined;
}

/** The alarm in the CloudWatch console, in the alarm's own region. */
function alarmUrl({ AlarmArn, AlarmName }: AlarmNotification): string {
  const region = AlarmArn.split(':')[3];
  return `https://console.aws.amazon.com/cloudwatch/home?region=${region}#alarmsV2:alarm/${encodeURIComponent(AlarmName)}`;
}
