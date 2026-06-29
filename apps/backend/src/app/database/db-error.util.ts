import { Logger } from '@nestjs/common';

/**
 * Postgres SQLSTATE codes that mean the live schema is missing something the
 * code expects — i.e. migration drift, NOT a transient/connection fault:
 *   42P01 = undefined_table   (e.g. custom_dinos never migrated)
 *   42703 = undefined_column  (e.g. dino_skills.when_to_activate never added)
 *
 * These must never be swallowed quietly: they indicate the DB is behind
 * schema.ts and a feature is silently no-op'ing in production.
 */
const SCHEMA_GAP_CODES = new Set(['42P01', '42703']);

/** True when the error is a missing-table / missing-column Postgres error. */
export function isSchemaGapError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false;
  const code = (err as { code: unknown }).code;
  return typeof code === 'string' && SCHEMA_GAP_CODES.has(code);
}

/**
 * Log a swallowed DB error. Routine failures log as a one-line error; schema-gap
 * (drift) failures escalate to an unmistakable banner so a missing migration is
 * loud in the deploy/runtime logs instead of degrading silently. Callers keep
 * their existing degradation behavior — this only changes the log signal.
 */
export function logDbError(logger: Logger, op: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (isSchemaGapError(err)) {
    const code = (err as { code?: string }).code;
    logger.error('================================================================================');
    logger.error(`SCHEMA DRIFT during "${op}": Postgres ${code} — ${message}`);
    logger.error('A table/column the code expects is missing. The DB is behind schema.ts —');
    logger.error('run the drizzle migrations (they run at boot) or generate a missing one.');
    logger.error('================================================================================');
    return;
  }
  logger.error(`${op} failed: ${message}`);
}
