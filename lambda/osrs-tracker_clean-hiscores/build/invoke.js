/**
 * Runs the dev build of the handler once, locally, with `DRY_RUN=true`: reads and external fetches happen, writes are
 * only logged. Use via `npm run invoke:dry`, with an Atlas database user in `.env` (see `.env.example`).
 */
if (process.env.DRY_RUN !== 'true') throw new Error('Refusing to run locally without DRY_RUN=true.');

const { handler } = require('../dist/index.js');

// Scheduled event for the current time, or for the ISO time passed as argument (e.g. `npm run invoke:dry -- 2026-10-02T18:00:00Z`)
const event = { time: process.argv[2] ?? new Date().toISOString() };

const context = {
  functionName: 'osrs-tracker_clean-hiscores',
  invokedFunctionArn: 'arn:aws:lambda:eu-central-1:000000000000:function:osrs-tracker_clean-hiscores',
  logStreamName: 'local',
};

handler(event, context)
  .then((result) => console.info('Result:', result))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100));
