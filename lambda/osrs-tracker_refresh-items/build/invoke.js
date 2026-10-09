/** `npm run invoke:dry [-- <ISO time>]`: runs the handler once with `DRY_RUN=true`, see shared/build/invoke.js. */
const { invokeDry, scheduledEvent } = require('../../shared/build/invoke');

invokeDry('osrs-tracker_refresh-items', scheduledEvent());
