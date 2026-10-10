import { isDeepStrictEqual } from 'node:util';
import { BSON, type Collection, type Filter } from 'mongodb';
import type { HiscoreLayout } from '@osrs-tracker/models';
import { isStoredEntry, migratePlayer, type AnyHiscoreEntry, type FailedEntry } from './migrate-player.ts';

/** The collection the layouts go to, the same name the Lambdas and the API use. */
export const LAYOUTS_COLLECTION = 'hiscoreLayouts';

/** The fields of `players` the migration reads and writes. */
export interface PlayerDoc {
  username: string;
  hiscoreEntries?: AnyHiscoreEntry[];
}

export interface MigrateOptions {
  /** Write the layouts and entries; without it the run only reads and reports (the default). */
  write: boolean;
  /** At most this many players (in username order). */
  limit?: number;
  /** Only this player. */
  player?: string;
  /** Progress and per-player problems; the report is returned, not logged. */
  log?: (line: string) => void;
}

export interface PlayerFailure {
  username: string;
  reason: string;
  entry?: FailedEntry;
}

export interface MigrateReport {
  write: boolean;
  players: { seen: number; converted: number; skipped: number; failed: number };
  /** Entries of the players seen, and of those how many were converted and how many were in the old format. */
  entries: { seen: number; converted: number; oldFormat: number };
  /** Layouts in `hiscoreLayouts` at the start, and new ids the run created (or would create, in a dry run). */
  layouts: { existing: number; created: number };
  /** BSON size of `{ hiscoreEntries }` summed over the players seen, before and after (unchanged when not converted). */
  bytes: { before: number; after: number };
  /** Writes that missed because the player changed after it was read; each was retried once. */
  retries: string[];
  failures: PlayerFailure[];
}

/**
 * Migrates every player with hiscore entries, one player at a time (Atlas free tier: no big aggregations or in-memory
 * sorts). Per player: read, {@link migratePlayer}, then with `write` upsert its layouts and replace its entries with one
 * `updateOne` that only applies when the document is unchanged since the read. A miss is retried once by re-reading.
 * A failed player gets nothing written; the run continues. Throws only on a layout hash collision or a database error.
 */
export async function migrate(
  players: Collection<PlayerDoc>,
  layoutsCollection: Collection<HiscoreLayout>,
  options: MigrateOptions,
): Promise<MigrateReport> {
  const log = options.log ?? (() => {});
  const layouts = new Map<number, HiscoreLayout>();
  for await (const layout of layoutsCollection.find()) layouts.set(layout._id, layout);

  const report: MigrateReport = {
    write: options.write,
    players: { seen: 0, converted: 0, skipped: 0, failed: 0 },
    entries: { seen: 0, converted: 0, oldFormat: 0 },
    layouts: { existing: layouts.size, created: 0 },
    bytes: { before: 0, after: 0 },
    retries: [],
    failures: [],
  };

  const filter: Filter<PlayerDoc> = { 'hiscoreEntries.0': { $exists: true } };
  if (options.player !== undefined) filter.username = options.player;
  // usernames only, in index order (no in-memory sort); each player is read on its own below
  const usernames = await players
    .find(filter, { projection: { _id: 0, username: 1 }, sort: { username: 1 }, hint: { username: 1 } })
    .limit(options.limit ?? 0)
    .map((doc) => doc.username)
    .toArray();
  log(`${usernames.length} players with hiscore entries, ${layouts.size} layouts${options.write ? '' : ' (dry run)'}`);

  for (const [n, username] of usernames.entries()) {
    await migrateOne(username);
    if ((n + 1) % 50 === 0) log(`${n + 1}/${usernames.length} players`);
  }
  return report;

  async function migrateOne(username: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const doc = await players.findOne(
        { username },
        { projection: { _id: 0, hiscoreEntries: 1 }, hint: { username: 1 } },
      );
      const stored = doc?.hiscoreEntries ?? [];
      if (stored.length === 0) return; // its entries were removed since the list was read
      const result = migratePlayer(stored, layouts);
      const before = BSON.calculateObjectSize({ hiscoreEntries: stored });

      if (result.status === 'converted') {
        for (const layout of result.layouts) await saveLayout(layout);
        if (options.write) {
          const { matchedCount } = await players.updateOne(
            unchangedFilter(username, stored),
            { $set: { hiscoreEntries: result.hiscoreEntries } },
            { hint: { username: 1 } },
          );
          if (matchedCount === 0) {
            if (attempt === 1) {
              log(`${username}: changed since it was read, retrying`);
              report.retries.push(username);
              continue;
            }
            return fail(username, stored, before, { reason: 'Changed since it was read, twice' });
          }
        }
        count(stored, before, BSON.calculateObjectSize({ hiscoreEntries: result.hiscoreEntries }));
        report.players.converted++;
        report.entries.converted += result.hiscoreEntries.length;
        report.entries.oldFormat += result.oldFormatEntries;
      } else if (result.status === 'skipped') {
        count(stored, before, before);
        report.players.skipped++;
      } else {
        fail(username, stored, before, result);
      }
      return;
    }
  }

  function fail(
    username: string,
    stored: AnyHiscoreEntry[],
    before: number,
    { reason, entry }: { reason: string; entry?: FailedEntry },
  ): void {
    const where = entry ? ` (entry ${entry.index}, ${entry.date.toISOString()}, offset ${entry.scrapingOffset})` : '';
    log(`FAILED ${username}${where}: ${reason}`);
    report.failures.push({ username, reason, entry });
    report.players.failed++;
    count(stored, before, before);
  }

  function count(stored: AnyHiscoreEntry[], before: number, after: number): void {
    report.players.seen++;
    report.entries.seen += stored.length;
    report.bytes.before += before;
    report.bytes.after += after;
  }

  /** Upserts a layout (in a dry run: only in memory). Throws when a layout with that id has other names. */
  async function saveLayout(layout: HiscoreLayout): Promise<void> {
    const known = layouts.get(layout._id);
    if (known) assertSameNames(known, layout);
    else report.layouts.created++;

    if (options.write) {
      const saved = await layoutsCollection.findOneAndUpdate(
        { _id: layout._id },
        { $setOnInsert: { skills: layout.skills, activities: layout.activities }, $min: { since: layout.since } },
        { upsert: true, returnDocument: 'after' },
      );
      if (!saved) throw new Error(`Layout ${layout._id} was not saved`);
      assertSameNames(saved, layout);
      layouts.set(layout._id, saved);
    } else if (!known || layout.since < known.since) {
      layouts.set(layout._id, { ...(known ?? layout), since: layout.since });
    }
  }
}

function assertSameNames(existing: HiscoreLayout, layout: HiscoreLayout): void {
  if (isDeepStrictEqual(existing.skills, layout.skills) && isDeepStrictEqual(existing.activities, layout.activities))
    return;
  throw new Error(`Layout ${layout._id} already exists with other names: a hash collision, stopping`);
}

/**
 * Matches the player only while its entries are as read: the same count, and the newest entry (by date) still at the
 * same position with the same date, in whichever format it is stored.
 */
function unchangedFilter(username: string, stored: AnyHiscoreEntry[]): Filter<PlayerDoc> {
  const dateOf = (entry: AnyHiscoreEntry) => (isStoredEntry(entry) ? entry.d : entry.date);
  let newest = 0;
  stored.forEach((entry, i) => {
    if (dateOf(entry) > dateOf(stored[newest])) newest = i;
  });
  const entry = stored[newest];
  return {
    username,
    hiscoreEntries: { $size: stored.length },
    [`hiscoreEntries.${newest}.${isStoredEntry(entry) ? 'd' : 'date'}`]: dateOf(entry),
  };
}

/** The report as text lines. */
export function formatReport(report: MigrateReport): string[] {
  const { players, entries, layouts, bytes } = report;
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  const saved = bytes.before ? (1 - bytes.after / bytes.before) * 100 : 0;
  return [
    report.write ? 'Written:' : 'Dry run, nothing written:',
    `  players  ${players.seen} seen, ${players.converted} converted, ${players.skipped} skipped, ${players.failed} failed`,
    `  entries  ${entries.seen} seen, ${entries.converted} converted (${entries.oldFormat} were in the old format)`,
    `  layouts  ${layouts.existing} existing, ${layouts.created} new`,
    `  size     ${mb(bytes.before)} -> ${mb(bytes.after)} of hiscoreEntries (${saved.toFixed(1)}% smaller, ratio ${
      bytes.before ? (bytes.after / bytes.before).toFixed(3) : '-'
    })`,
    ...(report.retries.length ? [`  retried  ${report.retries.join(', ')}`] : []),
    ...report.failures.map(({ username, reason }) => `  FAILED   ${username}: ${reason}`),
  ];
}
