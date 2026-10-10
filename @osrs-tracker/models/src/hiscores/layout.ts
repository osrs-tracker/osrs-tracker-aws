import { HiscoreLayout, HiscoreLayoutNames } from '../models/hiscores.js';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const utf8 = new TextEncoder();

/**
 * The id of a layout: 32-bit FNV-1a over the UTF-8 bytes of `JSON.stringify([skills, activities])`, as a signed int32
 * (`hash | 0`) so MongoDB stores it as an int32, not an 8-byte double. Names in Jagex's order: another order is another
 * layout.
 */
export function layoutId(skills: readonly string[], activities: readonly string[]): number {
  const bytes = utf8.encode(JSON.stringify([skills, activities]));
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash | 0;
}

/** The `hiscoreLayouts` document for a name list, first used at `since`. Copies the name arrays. */
export function createHiscoreLayout(names: HiscoreLayoutNames, since: Date): HiscoreLayout {
  return {
    _id: layoutId(names.skills, names.activities),
    skills: [...names.skills],
    activities: [...names.activities],
    since,
  };
}
