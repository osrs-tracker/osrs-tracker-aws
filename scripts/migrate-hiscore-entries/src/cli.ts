// Usage: node --env-file=.env src/cli.ts [--write] [--limit <n>] [--player <username>]. See README.md.
import { parseArgs } from 'node:util';
import { MongoClient } from 'mongodb';
import type { HiscoreLayout } from '@osrs-tracker/models';
import { formatReport, LAYOUTS_COLLECTION, migrate, type PlayerDoc } from './migrate.ts';

const { values: args } = parseArgs({
  options: {
    write: { type: 'boolean', default: false },
    limit: { type: 'string' },
    player: { type: 'string' },
  },
  strict: true,
});

const limit = args.limit === undefined ? undefined : Number(args.limit);
if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
  throw new Error('--limit takes a whole number >= 1');

/** Names the missing variables, never prints a value. */
function env(): Record<'uri' | 'database' | 'collection', string> & { username?: string; password?: string } {
  const required = ['MONGODB_URI', 'MONGODB_DATABASE', 'MONGODB_COLLECTION'] as const;
  const missing: string[] = required.filter((name) => !process.env[name]);
  const username = process.env.MONGODB_USERNAME || undefined;
  const password = process.env.MONGODB_PASSWORD || undefined;
  if (username && !password) missing.push('MONGODB_PASSWORD (required with MONGODB_USERNAME)');
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return {
    uri: process.env.MONGODB_URI!,
    database: process.env.MONGODB_DATABASE!,
    collection: process.env.MONGODB_COLLECTION!,
    username,
    password,
  };
}

const config = env();
// SCRAM with an Atlas database user, like the Lambdas locally; no credentials for a local mongod without auth
const client = new MongoClient(config.uri, {
  appName: 'migrate-hiscore-entries',
  ...(config.username ? { auth: { username: config.username, password: config.password } } : {}),
});

try {
  const db = client.db(config.database);
  const report = await migrate(
    db.collection<PlayerDoc>(config.collection),
    db.collection<HiscoreLayout>(LAYOUTS_COLLECTION),
    { write: args.write, limit, player: args.player, log: (line) => console.log(line) },
  );
  console.log(formatReport(report).join('\n'));
  if (report.players.failed > 0) process.exitCode = 1;
} finally {
  await client.close();
}
