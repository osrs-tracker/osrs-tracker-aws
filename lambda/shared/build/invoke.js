const path = require('path');

/**
 * Runs the dev build of a Lambda's handler (`dist/index.js`, from the Lambda's folder) once, locally, with
 * `DRY_RUN=true`: reads and external fetches happen, writes are only logged. Each Lambda's `build/invoke.js` calls it
 * with its name and event; use it via `npm run invoke:dry`, with an Atlas database user in `.env` (see `.env.example`).
 */
function invokeDry(functionName, event) {
  if (process.env.DRY_RUN !== 'true') throw new Error('Refusing to run locally without DRY_RUN=true.');

  const { handler } = require(path.resolve('dist/index.js'));

  const context = {
    functionName,
    invokedFunctionArn: `arn:aws:lambda:eu-central-1:000000000000:function:${functionName}`,
    logStreamName: 'local',
  };

  handler(event, context)
    .then((result) => console.info('Result:', result))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => setTimeout(() => process.exit(), 100));
}

/** The scheduled event for the ISO time passed as argument (`npm run invoke:dry -- 2026-10-02T18:00:00Z`), or now. */
function scheduledEvent() {
  return { time: process.argv[2] ?? new Date().toISOString() };
}

module.exports = { invokeDry, scheduledEvent };
