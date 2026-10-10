// Test helpers: old-format histories built from the 4 real Jagex responses in @osrs-tracker/hiscores' fixtures.
import { readFileSync } from 'node:fs';
import { fromJagex, type JagexHiscoreJson } from '@osrs-tracker/hiscores';
import { levelForXp, type HiscoreEntry } from '@osrs-tracker/models';
import type { OldHiscoreEntry } from './migrate-player.ts';

/** A name in neither `SkillEnum` nor `ActivityEnum`, as Jagex adds them. */
export const NEW_ACTIVITY = 'A Boss In Neither Enum';

/** The 4 real public `index_lite.json` responses, read from the repo (not copied), parsed fresh on every call. */
export function jagexFixtures(): Record<string, JagexHiscoreJson> {
  const url = new URL('../../../@osrs-tracker/hiscores/src/fixtures/jagex-hiscores.json', import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

/** `n` days after 2026-08-01 at `offset` hours past UTC midnight. */
export function day(n: number, offset = 0): Date {
  return new Date(Date.UTC(2026, 7, 1 + n, offset));
}

/**
 * The old stored entry of `json` on day `n`: every rank moves each day, some xp and scores grow on some days (so some
 * values are unchanged, some not), an activity without a score gets one from day 4, and from `newActivityFrom` on
 * Jagex lists {@link NEW_ACTIVITY} (a new layout). Levels follow xp, as Jagex's do.
 */
export function oldEntry(
  json: JagexHiscoreJson,
  n: number,
  offset = 0,
  { newActivityFrom = Infinity, name }: { newActivityFrom?: number; name?: string } = {},
): OldHiscoreEntry {
  const rank = (r: number, i: number) => (r > 0 ? r + ((n * (i + 3)) % 17) : r);
  const skills = json.skills.map((skill, i) => {
    if (i === 0) return { ...skill, rank: rank(skill.rank, i), xp: skill.xp > 0 ? skill.xp + n * 5_000 : skill.xp };
    const grows = skill.xp > 0 && i % 3 === n % 3;
    const xp = grows ? skill.xp + n * 1_000 : skill.xp;
    return { ...skill, rank: rank(skill.rank, i), xp, level: grows ? levelForXp(xp) : skill.level };
  });
  const firstWithoutScore = json.activities.findIndex((activity) => activity.score <= 0);
  const activities = json.activities.map((activity, i) => {
    if (i === firstWithoutScore && n >= 4) return { ...activity, rank: -1, score: n };
    const grows = activity.score > 0 && i % 4 === n % 4;
    return { ...activity, rank: rank(activity.rank, i), score: grows ? activity.score + n : activity.score };
  });
  if (n >= newActivityFrom) activities.push({ id: activities.length, name: NEW_ACTIVITY, rank: 50 + n, score: n });
  return { date: day(n, offset), scrapingOffset: offset, skills, activities, ...(name ? { name } : {}) };
}

/** An old-format history of days `from` to `to` on each offset, newest first as stored. */
export function oldHistory(
  json: JagexHiscoreJson,
  {
    from = 0,
    to = 9,
    offsets = [0],
    newActivityFrom,
  }: Partial<Record<'from' | 'to', number>> & {
    offsets?: number[];
    newActivityFrom?: number;
  } = {},
): OldHiscoreEntry[] {
  const entries: OldHiscoreEntry[] = [];
  for (let n = from; n <= to; n++)
    for (const offset of offsets) entries.push(oldEntry(json, n, offset, { newActivityFrom }));
  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** What the migration must decode to: each old entry mapped with `fromJagex`, newest first. */
export function mapped(entries: readonly OldHiscoreEntry[]): HiscoreEntry[] {
  return entries
    .map((entry) => {
      const { skills, activities } = fromJagex({ name: '', skills: entry.skills, activities: entry.activities });
      return { date: entry.date, scrapingOffset: entry.scrapingOffset, skills, activities };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
