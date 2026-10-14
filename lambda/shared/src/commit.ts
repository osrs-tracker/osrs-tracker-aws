// the commit the bundle was built from, set by build/esbuild.js (`define`)
declare const __COMMIT__: string;

// unbundled code (a Vitest run of a handler) has no `define`
const COMMIT = typeof __COMMIT__ === 'undefined' ? 'unknown' : __COMMIT__;

/**
 * Logs the commit the bundle was built from, so a deployed version can be tied to its code: `-dirty` when lambda/ had
 * uncommitted changes, `unknown` without git. Call it once, at module scope in the Lambda's `src/index.ts`, so every
 * cold start logs it.
 */
export function logCommit(): void {
  console.info(`Built from commit ${COMMIT}`);
}
