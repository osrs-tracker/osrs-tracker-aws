/**
 * `npm run invoke:dry [-- OK]`: runs the handler once with `DRY_RUN=true` (see shared/build/invoke.js) on a sample
 * alarm notification for refresh-items' alarm: going into `ALARM`, or with `OK` back from it.
 */
const { invokeDry } = require('../../shared/build/invoke');

const recovered = process.argv[2] === 'OK';

/** A CloudWatch alarm's SNS notification, cut down to the fields the handler reads. */
const message = {
  AlarmName: 'osrs-tracker_refresh-items-errors',
  AlarmArn: 'arn:aws:cloudwatch:eu-central-1:000000000000:alarm:osrs-tracker_refresh-items-errors',
  NewStateValue: recovered ? 'OK' : 'ALARM',
  OldStateValue: recovered ? 'ALARM' : 'OK',
  NewStateReason: `Threshold Crossed: 1 out of the last 1 datapoints [${recovered ? '0.0' : '1.0'} (14/10/26 10:00:00)] was ${recovered ? 'not ' : ''}greater than or equal to the threshold (1.0).`,
  StateChangeTime: new Date().toISOString(),
  Trigger: {
    MetricName: 'Errors',
    Namespace: 'AWS/Lambda',
    Dimensions: [{ value: 'osrs-tracker_refresh-items', name: 'FunctionName' }],
  },
};

invokeDry('osrs-tracker_alarm-to-discord', {
  Records: [{ EventSource: 'aws:sns', Sns: { Type: 'Notification', Message: JSON.stringify(message) } }],
});
