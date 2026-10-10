import { describe, expect, it } from 'vitest';
import { codecFixtures } from './codec.test-utils.js';
import { createHiscoreLayout, layoutId } from './layout.js';

const { skills, activities } = codecFixtures()['b0aty'].layout;

describe('layoutId', () => {
  it('is stable for the fixtures layout', () => {
    // Pinned: changing it orphans every stored layout. Cross-checked with an independent FNV-1a in Python.
    expect(layoutId(skills, activities)).toBe(699306799);
  });

  it('is the same for every fixture, which share one layout', () => {
    for (const { layout } of Object.values(codecFixtures())) {
      expect(layoutId(layout.skills, layout.activities)).toBe(699306799);
    }
  });

  it('hashes the UTF-8 bytes of the JSON as a signed int32', () => {
    expect(layoutId([], [])).toBe(-796440147);
    expect(layoutId(['Overall', 'Ünïcode'], ['A'])).toBe(-1824484757);
  });

  it('stays within the int32 range', () => {
    const ids = [layoutId(skills, activities), layoutId([], []), layoutId(['a'], []), layoutId([], ['a'])];
    for (let i = 0; i < 200; i++) ids.push(layoutId([`Skill ${i}`], [`Activity ${i * 7}`]));
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBe(id | 0);
    }
    expect(ids.some((id) => id < 0)).toBe(true);
  });

  it('differs when one name changes', () => {
    const base = layoutId(skills, activities);
    expect(layoutId(['Overal', ...skills.slice(1)], activities)).not.toBe(base);
    expect(layoutId(skills, [...activities.slice(0, -1), 'Some New Boss'])).not.toBe(base);
    expect(layoutId([...skills, 'New Skill'], activities)).not.toBe(base);
  });

  it('differs when the order changes', () => {
    const base = layoutId(skills, activities);
    expect(layoutId([skills[0], skills[2], skills[1], ...skills.slice(3)], activities)).not.toBe(base);
    expect(layoutId(skills, [...activities].reverse())).not.toBe(base);
  });

  it('differs when a name moves between skills and activities', () => {
    expect(layoutId(['a', 'b'], ['c'])).not.toBe(layoutId(['a'], ['b', 'c']));
  });
});

describe('createHiscoreLayout', () => {
  it('builds the hiscoreLayouts document with copies of the names', () => {
    const since = new Date('2026-10-10T00:00:00Z');
    const names = { skills: [...skills], activities: [...activities] };
    const layout = createHiscoreLayout(names, since);

    expect(layout).toEqual({ _id: 699306799, skills, activities, since });
    expect(layout.skills).not.toBe(names.skills);
    expect(layout.activities).not.toBe(names.activities);
  });
});
