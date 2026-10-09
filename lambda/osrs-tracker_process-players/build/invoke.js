/**
 * `npm run invoke:dry -- <username> [username...]`: runs the handler once with `DRY_RUN=true`, see
 * shared/build/invoke.js.
 */
const { invokeDry } = require('../../shared/build/invoke');

// SQS event with one message containing the usernames passed as arguments
const usernames = process.argv.slice(2);
if (!usernames.length) throw new Error('Pass at least one username.');

invokeDry('osrs-tracker_process-players', {
  Records: [{ body: JSON.stringify({ usernames, scrapingOffset: 0 }), attributes: { ApproximateReceiveCount: '1' } }],
});
