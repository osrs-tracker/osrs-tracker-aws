import { describe, expect, it } from '@jest/globals';
import {
  createHiscoreLayout,
  decodeHiscoreEntries,
  encodeHiscoreEntry,
  HiscoreEntry,
  HiscoreLayout,
  levelForXp,
  stripUnchangedValues,
} from '@osrs-tracker/models';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fromJagex, JagexHiscoreJson } from './mapper/from-jagex';
import { getOverallXpDiff, hiscoreDiff } from './parser/parser';

const raw: Record<string, JagexHiscoreJson> = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/jagex-hiscores.json'), 'utf8'),
);

/** A response from after Jagex added a skill and an activity that no enum knows yet. */
function withNewNames(json: JagexHiscoreJson, gained: number): JagexHiscoreJson {
  return {
    ...json,
    skills: [
      ...json.skills,
      {
        id: 99,
        name: 'Some New Skill',
        rank: -1,
        level: gained ? levelForXp(500 + gained) : 1,
        xp: gained ? 500 + gained : -1,
      },
    ],
    activities: [...json.activities, { id: 99, name: 'Some New Boss', rank: 42, score: 3 + gained }],
  };
}

/** Maps a response the way writers will: `fromJagex`, a layout, an entry. */
function toEntry(json: JagexHiscoreJson, date: Date): { entry: HiscoreEntry; layout: HiscoreLayout } {
  const { skills, activities, layout } = fromJagex(json);
  return { entry: { date, scrapingOffset: 0, skills, activities }, layout: createHiscoreLayout(layout, date) };
}

describe('fromJagex → encode → decode → hiscoreDiff', () => {
  it.each(Object.keys(raw))('keeps every value of %s, including names in neither enum', (label) => {
    const older = toEntry(withNewNames(raw[label], 0), new Date('2026-10-09T00:00:00Z'));
    const newer = toEntry(withNewNames(raw[label], 1_000), new Date('2026-10-10T00:00:00Z'));
    const layouts = new Map([[newer.layout._id, newer.layout]]);

    // stored newest first, the older entry stripped against the newer one as the write expression does
    const storedNewer = encodeHiscoreEntry(newer.entry, newer.layout);
    const storedOlder = stripUnchangedValues(storedNewer, encodeHiscoreEntry(older.entry, older.layout));
    const [decodedNewer, decodedOlder] = decodeHiscoreEntries([storedNewer, storedOlder], layouts);

    expect(decodedNewer).toEqual(newer.entry);
    expect(decodedOlder).toEqual(older.entry);

    const diff = hiscoreDiff(decodedNewer, decodedOlder);
    // no xp before: level 1, rank 0
    expect(diff.skills['Some New Skill']).toEqual({ rank: 0, level: levelForXp(1_500) - 1, xp: 1_500 });
    expect(diff.activities['Some New Boss']).toEqual({ rank: 0, score: 1_000 });
    expect(getOverallXpDiff(decodedNewer, decodedOlder)).toBe(0);
  });
});
