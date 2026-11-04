/**
 * `npm run invoke:dry -- [--table=<hiscore table>] <username> [username...]`: runs the handler once with `DRY_RUN=true`,
 * see shared/build/invoke.js.
 */
const { parseArgs } = require('node:util');
const { invokeDry } = require('../../shared/build/invoke');

// the event queue-players sends, with the usernames passed as arguments
const { values, positionals: usernames } = parseArgs({
  options: { table: { type: 'string' } },
  allowPositionals: true,
});
if (!usernames.length) throw new Error('Pass at least one username.');

invokeDry('osrs-tracker_process-players', {
  usernames,
  scrapingOffset: 0,
  ...(values.table && { table: values.table }),
});
