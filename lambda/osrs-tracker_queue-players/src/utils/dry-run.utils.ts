/**
 * When `DRY_RUN=true`, writes (MongoDB, SQS, Discord) are logged instead of executed. Reads and external fetches still
 * happen. Never set in production.
 */
export const DRY_RUN = process.env.DRY_RUN === 'true';

/** Logs a write that was skipped because of `DRY_RUN`. */
export function logDryRun(action: string, details?: unknown): void {
  console.info(`[DRY_RUN] Would ${action}`, details === undefined ? '' : JSON.stringify(details, null, 2));
}
