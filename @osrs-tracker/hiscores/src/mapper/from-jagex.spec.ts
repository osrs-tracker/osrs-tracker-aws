import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fromJagex, JagexHiscoreActivity, JagexHiscoreJson, JagexHiscoreSkill } from './from-jagex';

const readJson = (path: string) => JSON.parse(readFileSync(join(__dirname, path), 'utf8'));

/** Four real `index_lite.json` responses, and the same mapped by models' fixture. */
const raw: Record<string, JagexHiscoreJson> = readJson('../fixtures/jagex-hiscores.json');
const mapped: Record<string, unknown> = readJson('../../../models/src/hiscores/fixtures/hiscores.json');

const overall: JagexHiscoreSkill = { id: 0, name: 'Overall', rank: 100, level: 50, xp: 1000 };

function json(skills: JagexHiscoreSkill[], activities: JagexHiscoreActivity[] = []): JagexHiscoreJson {
  return { name: 'zezima', skills: [overall, ...skills], activities };
}

describe('fromJagex', () => {
  describe('skills', () => {
    it.each([
      ['ranked', { rank: 5, level: 60, xp: 300_000 }, { rank: 5, level: 60, xp: 300_000 }],
      ['unranked with xp', { rank: -1, level: 10, xp: 1_200 }, { rank: null, level: 10, xp: 1_200 }],
      ['xp -1', { rank: -1, level: 1, xp: -1 }, null],
      ['xp 0 (Sailing)', { rank: -1, level: 1, xp: 0 }, null],
    ])('maps %s', (_, jagex, domain) => {
      const { skills } = fromJagex(json([{ id: 1, name: 'Sailing', ...jagex }]));
      expect(skills['Sailing']).toEqual(domain);
    });

    it('never maps Overall to null and keeps its level', () => {
      const { skills } = fromJagex({
        name: 'zezima',
        skills: [{ id: 0, name: 'Overall', rank: -1, level: 32, xp: -1 }],
        activities: [],
      });
      expect(skills['Overall']).toEqual({ rank: null, level: 32, xp: 0 });
    });

    it('maps a ranked Overall as is', () => {
      expect(fromJagex(json([])).skills['Overall']).toEqual({ rank: 100, level: 50, xp: 1000 });
    });
  });

  describe('activities', () => {
    it.each([
      ['ranked', { rank: 12, score: 40 }, { rank: 12, score: 40 }],
      ['unranked with a score', { rank: -1, score: 3 }, { rank: null, score: 3 }],
      ['score -1', { rank: -1, score: -1 }, null],
      ['score 0', { rank: -1, score: 0 }, null],
    ])('maps %s', (_, jagex, domain) => {
      const { activities } = fromJagex(json([], [{ id: 0, name: 'Grid Points', ...jagex }]));
      expect(activities['Grid Points']).toEqual(domain);
    });
  });

  it("keeps names in neither enum and records the layout in Jagex's order, without ids", () => {
    const result = fromJagex(
      json(
        [
          { id: 1, name: 'Attack', rank: 3, level: 99, xp: 13_034_431 },
          { id: 2, name: 'Necromancy', rank: 9, level: 2, xp: 100 },
        ],
        [
          { id: 0, name: 'Moon Raids', rank: 4, score: 7 },
          { id: 1, name: 'Grid Points', rank: -1, score: -1 },
        ],
      ),
    );

    expect(result).toEqual({
      skills: {
        Overall: { rank: 100, level: 50, xp: 1000 },
        Attack: { rank: 3, level: 99, xp: 13_034_431 },
        Necromancy: { rank: 9, level: 2, xp: 100 },
      },
      activities: { 'Moon Raids': { rank: 4, score: 7 }, 'Grid Points': null },
      layout: { skills: ['Overall', 'Attack', 'Necromancy'], activities: ['Moon Raids', 'Grid Points'] },
    });
  });

  it('maps real responses like the models fixture', () => {
    expect(Object.keys(raw).sort()).toEqual(Object.keys(mapped).sort());
    for (const label of Object.keys(raw)) expect(fromJagex(raw[label])).toEqual(mapped[label]);
  });
});
