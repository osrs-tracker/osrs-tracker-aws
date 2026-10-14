import { Context, SNSEvent } from 'aws-lambda';
import { discordAlert } from '@lambda/shared/discord-alert';
import { logCommit } from '@lambda/shared/commit';
import { alarmAlert, parseAlarm } from './utils/alarm.utils';
import { env } from './env';

logCommit();

/**
 * Posts the CloudWatch alarms of the SNS topic `osrs-tracker-alerts` to Discord. Throws when a message isn't an alarm or
 * Discord can't be reached, so Lambda retries the invocation; the topic's email subscription gets every alarm anyway.
 */
export const handler = async (event: SNSEvent, context: Context) => {
  for (const record of event.Records) {
    const alarm = parseAlarm(record.Sns.Message);
    const alert = alarmAlert(alarm);

    if (!alert) {
      console.info(`Skipped ${alarm.AlarmName}: ${alarm.OldStateValue} -> ${alarm.NewStateValue}`);
      continue;
    }

    const { title, description, ...options } = alert;
    await discordAlert(env.WEBHOOK_URL, title, description, context, options);
    console.info(`Posted ${alarm.AlarmName}: ${alarm.OldStateValue} -> ${alarm.NewStateValue}`);
  }
};
