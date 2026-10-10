import { describe, expect, it } from 'vitest';
import { ActivityEnum, SkillEnum } from '../models/hiscore.enum.js';
import { HiscoreEntry, HiscoreLayout, StoredHiscoreEntry } from '../models/hiscores.js';
import { levelForXp } from '../xp/levels.js';
import { decodeHiscoreEntries, encodeHiscoreEntry, hiscoreLayoutIds, UnknownHiscoreLayoutError } from './codec.js';
import { codecFixtures, day, nextEntry, writeStoredEntry } from './codec.test-utils.js';
import { createHiscoreLayout } from './layout.js';

const fixtures = codecFixtures();
const fixtureLayout = createHiscoreLayout(fixtures['b0aty'].layout, day(0));
const layouts = new Map([[fixtureLayout._id, fixtureLayout]]);

const NEW_SKILL = 'Test Skill Not In Any Enum';
const NEW_ACTIVITY = 'Test Activity Not In Any Enum';

function fixtureEntry(player: string, date = day(0), scrapingOffset = 0): HiscoreEntry {
  const { skills, activities } = codecFixtures()[player];
  return { date, scrapingOffset, skills, activities };
}

function skill(rank: number | null, xp: number) {
  return { rank, level: levelForXp(xp), xp };
}

/** Writes `entries` oldest first through {@link writeStoredEntry}; returns the stored history, newest first. */
function store(entries: HiscoreEntry[], layoutFor: (entry: HiscoreEntry) => HiscoreLayout = () => fixtureLayout) {
  return entries.reduce<StoredHiscoreEntry[]>(
    (history, entry) => writeStoredEntry(history, encodeHiscoreEntry(entry, layoutFor(entry))),
    [],
  );
}

it('tests names that are in neither enum', () => {
  expect(Object.values<string>(SkillEnum)).not.toContain(NEW_SKILL);
  expect(Object.values<string>(ActivityEnum)).not.toContain(NEW_ACTIVITY);
});

describe('encodeHiscoreEntry and decodeHiscoreEntries', () => {
  describe.each(Object.keys(fixtures))('fixture %s', (player) => {
    it('round trips', () => {
      const entry = fixtureEntry(player, day(3, 5), 5);
      const stored = encodeHiscoreEntry(entry, fixtureLayout);

      expect(decodeHiscoreEntries([stored], layouts)).toEqual([entry]);
    });

    it('stores Overall with its level, other values as [rank, xp/score] or null', () => {
      const entry = fixtureEntry(player);
      const stored = encodeHiscoreEntry(entry, fixtureLayout);
      const overall = entry.skills[SkillEnum.Overall]!;

      expect(stored).toMatchObject({ d: entry.date, o: 0, l: fixtureLayout._id });
      expect(stored.s[0]).toEqual([overall.rank, overall.level, overall.xp]);
      fixtureLayout.skills.slice(1).forEach((name, i) => {
        const value = entry.skills[name];
        expect(stored.s[i + 1]).toEqual(value ? [value.rank, value.xp] : null);
      });
      fixtureLayout.activities.forEach((name, i) => {
        const value = entry.activities[name];
        expect(stored.a[i]).toEqual(value ? [value.rank, value.score] : null);
      });
    });

    it("has Jagex's level equal to levelForXp for every skill but Overall", () => {
      const mismatches = Object.entries(fixtures[player].skills)
        .filter(([name, value]) => name !== SkillEnum.Overall && value && value.level !== levelForXp(value.xp))
        .map(([name]) => name);
      expect(mismatches).toEqual([]);
    });
  });

  it('covers 99s, 200M xp, unranked values and no values in the fixtures', () => {
    const all = Object.values(fixtures);
    const skills = all.flatMap((f) => Object.values(f.skills));
    const activities = all.flatMap((f) => Object.values(f.activities));
    expect(skills.some((s) => s?.xp === 200_000_000)).toBe(true);
    expect(skills.some((s) => s?.level === 99 && s.xp < 14_000_000)).toBe(true);
    expect(skills.some((s) => s && s.rank === null)).toBe(true);
    expect(skills).toContain(null);
    expect(activities.some((a) => a && a.rank === null)).toBe(true);
    expect(activities).toContain(null);
  });

  it('round trips names in neither enum', () => {
    const layout = createHiscoreLayout(
      { skills: [SkillEnum.Overall, NEW_SKILL, SkillEnum.Attack], activities: [NEW_ACTIVITY, ActivityEnum.Zulrah] },
      day(0),
    );
    const entry: HiscoreEntry = {
      date: day(1),
      scrapingOffset: -3,
      skills: { [SkillEnum.Overall]: { rank: 5, level: 3, xp: 1_500 }, [NEW_SKILL]: skill(null, 1_000), Attack: null },
      activities: { [NEW_ACTIVITY]: { rank: 42, score: 7 }, [ActivityEnum.Zulrah]: { rank: null, score: 3 } },
    };
    const stored = encodeHiscoreEntry(entry, layout);

    expect(stored.s).toEqual([[5, 3, 1_500], [null, 1_000], null]);
    expect(stored.a).toEqual([
      [42, 7],
      [null, 3],
    ]);
    expect(decodeHiscoreEntries([stored], new Map([[layout._id, layout]]))).toEqual([entry]);
  });

  it('encodes a missing key as null and decodes it as null', () => {
    const entry = fixtureEntry('b0aty');
    delete entry.skills[SkillEnum.Attack];
    delete entry.activities[ActivityEnum.Zulrah];
    const stored = encodeHiscoreEntry(entry, fixtureLayout);

    expect(stored.s[fixtureLayout.skills.indexOf(SkillEnum.Attack)]).toBeNull();
    expect(stored.a[fixtureLayout.activities.indexOf(ActivityEnum.Zulrah)]).toBeNull();
    const [decoded] = decodeHiscoreEntries([stored], layouts);
    expect(decoded.skills[SkillEnum.Attack]).toBeNull();
    expect(decoded.activities[ActivityEnum.Zulrah]).toBeNull();
  });

  it('decodes keys in layout order', () => {
    const [decoded] = decodeHiscoreEntries([encodeHiscoreEntry(fixtureEntry('zezima'), fixtureLayout)], layouts);
    expect(Object.keys(decoded.skills)).toEqual(fixtureLayout.skills);
    expect(Object.keys(decoded.activities)).toEqual(fixtureLayout.activities);
  });

  it('throws on a name the layout does not have', () => {
    const entry = fixtureEntry('b0aty');
    entry.skills[NEW_SKILL] = skill(1, 100);
    expect(() => encodeHiscoreEntry(entry, fixtureLayout)).toThrow(NEW_SKILL);

    const other = fixtureEntry('b0aty');
    other.activities[NEW_ACTIVITY] = { rank: 1, score: 1 };
    expect(() => encodeHiscoreEntry(other, fixtureLayout)).toThrow(NEW_ACTIVITY);
  });

  it('throws without Overall', () => {
    const entry = fixtureEntry('b0aty');
    entry.skills[SkillEnum.Overall] = null;
    expect(() => encodeHiscoreEntry(entry, fixtureLayout)).toThrow('Overall');
  });

  it('decodes a rank of 0 in a full value as null', () => {
    const stored = encodeHiscoreEntry(fixtureEntry('b0aty'), fixtureLayout);
    stored.s[1] = [0, 1_000];
    stored.a[0] = [0, 5];
    const [decoded] = decodeHiscoreEntries([stored], layouts);
    expect(decoded.skills[fixtureLayout.skills[1]]).toEqual(skill(null, 1_000));
    expect(decoded.activities[fixtureLayout.activities[0]]).toEqual({ rank: null, score: 5 });
  });
});

describe('decodeHiscoreEntries with bare values', () => {
  const small = createHiscoreLayout(
    {
      skills: [SkillEnum.Overall, SkillEnum.Attack, NEW_SKILL],
      activities: [ActivityEnum.ClueScrollsAll, NEW_ACTIVITY],
    },
    day(0),
  );
  const smallLayouts = new Map([[small._id, small]]);

  it('resolves a hand-crafted chain, newest first', () => {
    const stored: StoredHiscoreEntry[] = [
      {
        d: day(3),
        o: 0,
        l: small._id,
        s: [
          [100, 50, 2_000],
          [200, 500],
          [null, 300],
        ],
        a: [
          [10, 5],
          [null, 7],
        ],
      },
      { d: day(2), o: 0, l: small._id, s: [[101, 50, 2_000], 201, 0], a: [11, 0] },
      { d: day(1), o: 0, l: small._id, s: [[102, 49, 1_900], [210, 400], 0], a: [12, null] },
      { d: day(0), o: 0, l: small._id, s: [[103, 49, 1_900], 211, 0], a: [null, null] },
    ];

    expect(decodeHiscoreEntries(stored, smallLayouts)).toEqual([
      {
        date: day(3),
        scrapingOffset: 0,
        skills: {
          Overall: { rank: 100, level: 50, xp: 2_000 },
          Attack: skill(200, 500),
          [NEW_SKILL]: skill(null, 300),
        },
        activities: { [ActivityEnum.ClueScrollsAll]: { rank: 10, score: 5 }, [NEW_ACTIVITY]: { rank: null, score: 7 } },
      },
      {
        date: day(2),
        scrapingOffset: 0,
        skills: {
          Overall: { rank: 101, level: 50, xp: 2_000 },
          Attack: skill(201, 500),
          [NEW_SKILL]: skill(null, 300),
        },
        activities: { [ActivityEnum.ClueScrollsAll]: { rank: 11, score: 5 }, [NEW_ACTIVITY]: { rank: null, score: 7 } },
      },
      {
        date: day(1),
        scrapingOffset: 0,
        skills: {
          Overall: { rank: 102, level: 49, xp: 1_900 },
          Attack: skill(210, 400),
          [NEW_SKILL]: skill(null, 300),
        },
        activities: { [ActivityEnum.ClueScrollsAll]: { rank: 12, score: 5 }, [NEW_ACTIVITY]: null },
      },
      {
        date: day(0),
        scrapingOffset: 0,
        skills: {
          Overall: { rank: 103, level: 49, xp: 1_900 },
          Attack: skill(211, 400),
          [NEW_SKILL]: skill(null, 300),
        },
        activities: { [ActivityEnum.ClueScrollsAll]: null, [NEW_ACTIVITY]: null },
      },
    ]);
  });

  it('resolves a value unchanged for several days', () => {
    const entries = [fixtureEntry('b0aty', day(0))];
    for (let n = 1; n < 5; n++) entries.push(nextEntry(entries[n - 1], day(n), { rankShift: n }));
    const stored = store(entries);

    expect(stored[0].s.every(Array.isArray)).toBe(true);
    for (const older of stored.slice(1)) {
      expect(Array.isArray(older.s[0])).toBe(true);
      expect(older.s.slice(1).filter(Array.isArray)).toEqual([]);
      expect(older.a.filter(Array.isArray)).toEqual([]);
      expect(older.s[1]).toBeTypeOf('number');
    }
    expect(decodeHiscoreEntries(stored, layouts)).toEqual([...entries].reverse());
  });

  it('resolves a value that changed in between', () => {
    const d0 = fixtureEntry('b0aty', day(0));
    const d1 = nextEntry(d0, day(1), { rankShift: -1 });
    const d2 = nextEntry(d1, day(2), {
      rankShift: -1,
      skills: { Attack: skill(31_000, 33_800_000) },
      activities: { [ActivityEnum.Zulrah]: { rank: 900, score: 5_000 } },
    });
    const d3 = nextEntry(d2, day(3), { rankShift: -1 });
    const stored = store([d0, d1, d2, d3]);

    const attack = fixtureLayout.skills.indexOf(SkillEnum.Attack);
    const zulrah = fixtureLayout.activities.indexOf(ActivityEnum.Zulrah);
    expect(stored.map((e) => e.s[attack])).toEqual([
      [31_000 - 1, 33_800_000],
      31_000,
      [31_218 - 1, 33_775_507],
      31_218,
    ]);
    expect(stored.map((e) => Array.isArray(e.a[zulrah]))).toEqual([true, false, true, false]);
    expect(decodeHiscoreEntries(stored, layouts)).toEqual([d3, d2, d1, d0]);
  });

  it('stores an unchanged unranked value as a bare 0 and decodes it as rank null', () => {
    const d0 = fixtureEntry('zezima', day(0));
    const d1 = nextEntry(d0, day(1));
    const ironD0 = fixtureEntry('iron-mammal', day(0), 12);
    const ironD1 = nextEntry(ironD0, day(1, 12));
    const stored = store([d0, ironD0, d1, ironD1]);

    const strength = fixtureLayout.skills.indexOf(SkillEnum.Strength);
    const hunter = fixtureLayout.activities.indexOf(ActivityEnum.BountyHunter);
    expect(d0.skills[SkillEnum.Strength]?.rank).toBeNull();
    expect(ironD0.activities[ActivityEnum.BountyHunter]?.rank).toBeNull();
    expect(stored.find((e) => e.o === 0 && e.d === d0.date)?.s[strength]).toBe(0);
    expect(stored.find((e) => e.o === 12 && e.d === ironD0.date)?.a[hunter]).toBe(0);

    const decoded = decodeHiscoreEntries(stored, layouts);
    expect(decoded).toEqual([ironD1, d1, ironD0, d0]);
    expect(decoded[3].skills[SkillEnum.Strength]?.rank).toBeNull();
  });

  it('carries values across a layout change by name', () => {
    const layoutA = fixtureLayout;
    const layoutB = createHiscoreLayout(
      {
        skills: [...layoutA.skills.slice(0, 5), NEW_SKILL, ...layoutA.skills.slice(5)],
        activities: [NEW_ACTIVITY, ...layoutA.activities],
      },
      day(2),
    );
    const both = new Map([
      [layoutA._id, layoutA],
      [layoutB._id, layoutB],
    ]);

    const d0 = fixtureEntry('b0aty', day(0));
    const d1 = nextEntry(d0, day(1), { rankShift: 1 });
    const d2 = nextEntry(d1, day(2), {
      rankShift: 1,
      skills: { [NEW_SKILL]: skill(5, 1_000) },
      activities: { [NEW_ACTIVITY]: { rank: null, score: 3 } },
    });
    const d3 = nextEntry(d2, day(3), { rankShift: 1 });
    const stored = store([d0, d1, d2, d3], (entry) => (entry.date >= day(2) ? layoutB : layoutA));

    // The writer only strips within one layout: the newest entry of layout A stays full.
    expect(stored.map((e) => e.l)).toEqual([layoutB._id, layoutB._id, layoutA._id, layoutA._id]);
    expect(stored[2].s.every(Array.isArray)).toBe(true);
    expect(stored[1].s[layoutB.skills.indexOf(NEW_SKILL)]).toBe(5);
    expect(stored[1].a[0]).toBe(0);
    expect(decodeHiscoreEntries(stored, both)).toEqual([d3, d2, d1, d0]);

    // A bare value in layout A resolves from layout B's full value of the same name, at another position.
    const handCrafted = [
      encodeHiscoreEntry(d2, layoutB),
      {
        ...encodeHiscoreEntry(d1, layoutA),
        s: [
          encodeHiscoreEntry(d1, layoutA).s[0],
          ...layoutA.skills.slice(1).map((name) => d1.skills[name]?.rank ?? null),
        ],
      },
    ];
    const [, decodedD1] = decodeHiscoreEntries(handCrafted, both);
    const attack = d1.skills[SkillEnum.Attack]!;
    expect(decodedD1.skills[SkillEnum.Attack]).toEqual({ ...d2.skills[SkillEnum.Attack], rank: attack.rank });
    expect(decodedD1.skills[NEW_SKILL]).toBeUndefined();
    expect(Object.keys(decodedD1.skills)).toEqual(layoutA.skills);
  });

  it('keeps two interleaved offsets apart', () => {
    const at0 = [fixtureEntry('b0aty', day(0, 0), 0)];
    const at12 = [
      nextEntry(fixtureEntry('b0aty', day(0, 12), 12), day(0, 12), {
        skills: { Attack: skill(30_000, 34_000_000) },
        activities: { [ActivityEnum.Zulrah]: { rank: 800, score: 6_000 } },
      }),
    ];
    at12[0].scrapingOffset = 12;
    for (let n = 1; n < 4; n++) {
      at0.push(nextEntry(at0[n - 1], day(n, 0), { rankShift: 2 }));
      at12.push(nextEntry(at12[n - 1], day(n, 12), { rankShift: -2 }));
    }
    const interleaved = at0.flatMap((entry, n) => [entry, at12[n]]);
    const stored = store(interleaved);

    expect(stored.map((e) => e.o)).toEqual([12, 0, 12, 0, 12, 0, 12, 0]);
    expect(stored.slice(2).every((e) => typeof e.s[1] === 'number')).toBe(true);
    expect(decodeHiscoreEntries(stored, layouts)).toEqual([...interleaved].reverse());
  });

  it('throws on a bare value with nothing carried', () => {
    const stored = encodeHiscoreEntry(fixtureEntry('b0aty'), fixtureLayout);
    stored.s[1] = 1234;
    expect(() => decodeHiscoreEntries([stored], layouts)).toThrow(fixtureLayout.skills[1]);

    const activity = encodeHiscoreEntry(fixtureEntry('b0aty'), fixtureLayout);
    activity.a[3] = 0;
    expect(() => decodeHiscoreEntries([activity], layouts)).toThrow(fixtureLayout.activities[3]);
  });

  it('throws on a bare value carried only from another offset', () => {
    const newer = encodeHiscoreEntry(fixtureEntry('b0aty', day(1), 0), fixtureLayout);
    const older = encodeHiscoreEntry(fixtureEntry('b0aty', day(0), 6), fixtureLayout);
    older.s[1] = 5;
    expect(() => decodeHiscoreEntries([newer, older], layouts)).toThrow('offset 6');
  });

  it('throws on a bare value whose newer value is null', () => {
    const stored: StoredHiscoreEntry[] = [
      { d: day(2), o: 0, l: small._id, s: [[1, 3, 200], [5, 100], null], a: [null, null] },
      {
        d: day(1),
        o: 0,
        l: small._id,
        s: [
          [1, 3, 200],
          [5, 100],
          [6, 50],
        ],
        a: [null, null],
      },
      { d: day(0), o: 0, l: small._id, s: [[1, 3, 200], 5, 6], a: [null, null] },
    ];
    expect(decodeHiscoreEntries(stored.slice(1), smallLayouts)).toHaveLength(2);
    expect(() => decodeHiscoreEntries([stored[0], stored[2]], smallLayouts)).toThrow(NEW_SKILL);
  });

  it('throws UnknownHiscoreLayoutError with the layout id', () => {
    const stored = { ...encodeHiscoreEntry(fixtureEntry('b0aty'), fixtureLayout), l: 12345 };
    let error: unknown;
    try {
      decodeHiscoreEntries([stored], layouts);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(UnknownHiscoreLayoutError);
    expect(error).toBeInstanceOf(Error);
    expect((error as UnknownHiscoreLayoutError).layoutId).toBe(12345);
    expect((error as UnknownHiscoreLayoutError).name).toBe('UnknownHiscoreLayoutError');
  });

  it('throws when an entry does not match its layout length', () => {
    const stored = encodeHiscoreEntry(fixtureEntry('b0aty'), fixtureLayout);
    stored.a.pop();
    expect(() => decodeHiscoreEntries([stored], layouts)).toThrow(String(fixtureLayout._id));
  });
});

describe('hiscoreLayoutIds', () => {
  it('returns the distinct layout ids in order of first use', () => {
    const entry = (l: number): StoredHiscoreEntry => ({ d: day(0), o: 0, l, s: [], a: [] });
    expect(hiscoreLayoutIds([entry(3), entry(-7), entry(3), entry(9), entry(-7)])).toEqual([3, -7, 9]);
    expect(hiscoreLayoutIds([])).toEqual([]);
  });
});

describe('decodeHiscoreEntries benchmark', () => {
  it('decodes 2 offsets x 60 mostly bare entries quickly', () => {
    const offsets = [0, 12];
    const domain: HiscoreEntry[] = [];
    const last = new Map(offsets.map((o) => [o, fixtureEntry('b0aty', day(0, o), o)]));
    for (let n = 0; n < 60; n++) {
      for (const o of offsets) {
        const previous = last.get(o)!;
        // Ranks move every day; one skill and one activity gain something every 4th day.
        const changes =
          n % 4 === 0
            ? {
                rankShift: -1,
                skills: { Attack: skill(31_000 - n, 33_775_507 + n * 1_000) },
                activities: { [ActivityEnum.Zulrah]: { rank: 900 - n, score: 5_000 + n } },
              }
            : { rankShift: 1 };
        const entry = n === 0 ? previous : nextEntry(previous, day(n, o), changes);
        last.set(o, entry);
        domain.push(entry);
      }
    }
    const stored = store(domain);
    const expected = [...domain].reverse();
    expect(decodeHiscoreEntries(stored, layouts)).toEqual(expected);

    const bare = stored.flatMap((e) => [...e.s, ...e.a]).filter((v) => typeof v === 'number').length;
    const values = stored.length * (fixtureLayout.skills.length + fixtureLayout.activities.length);
    expect(bare / values).toBeGreaterThan(0.5);

    const runs: number[] = [];
    for (let run = 0; run < 15; run++) {
      const start = performance.now();
      decodeHiscoreEntries(stored, layouts);
      runs.push(performance.now() - start);
    }
    runs.sort((a, b) => a - b);
    const median = runs[Math.floor(runs.length / 2)];
    console.log(
      `decodeHiscoreEntries: ${stored.length} entries (${Math.round((bare / values) * 100)}% bare values), ` +
        `median ${median.toFixed(3)} ms over ${runs.length} runs`,
    );
    expect(median).toBeLessThan(50);
  });
});
