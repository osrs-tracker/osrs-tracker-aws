/**
 * Runs the dev build of the handler once, locally, with `DRY_RUN=true`: reads and external fetches happen, writes are
 * only logged. Use via `npm run invoke:dry -- <username> [username...]`, with an Atlas database user in `.env` (see
 * `.env.example`).
 */
if (process.env.DRY_RUN !== 'true') throw new Error('Refusing to run locally without DRY_RUN=true.');

const { handler } = require('../dist/index.js');

// SQS event with one message containing the usernames passed as arguments
const usernames = process.argv.slice(2);
if (!usernames.length) throw new Error('Pass at least one username.');

const event = {
  Records: [{ body: JSON.stringify({ usernames, scrapingOffset: 0 }), attributes: { ApproximateReceiveCount: '1' } }],
};

const context = {
  functionName: 'osrs-tracker_process-players',
  invokedFunctionArn: 'arn:aws:lambda:eu-central-1:000000000000:function:osrs-tracker_process-players',
  logStreamName: 'local',
};

handler(event, context)
  .then((result) => console.info('Result:', result))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100));
