/**
 * `npm run invoke:dry -- <username> [username...]`: runs the handler once with `DRY_RUN=true`, see
 * shared/build/invoke.js.
 */
const { invokeDry } = require('../../shared/build/invoke');

// the event queue-players sends, with the usernames passed as arguments
const usernames = process.argv.slice(2);
if (!usernames.length) throw new Error('Pass at least one username.');

invokeDry('osrs-tracker_process-players', { usernames, scrapingOffset: 0 });
