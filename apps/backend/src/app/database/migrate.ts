import { Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { Pool } from 'pg';
import { buildPoolConfig } from './connection';

const logger = new Logger('Migrations');

/**
 * Run pending drizzle SQL migrations at boot time.
 *
 * Guards:
 * - No DATABASE_URL → log and return (local/e2e mode, matching database.module null-db path).
 * - MIGRATIONS_DIR env → explicit folder override (useful for testing/custom deploys).
 * - Default folder: join(__dirname, '..', 'drizzle') → at runtime /app/dist/../drizzle = /app/drizzle
 *   (Dockerfile copies apps/backend/drizzle → /app/drizzle).
 *
 * Failure behavior (D-06): on error we log an unmistakable banner and re-throw so bootstrap()
 * aborts before app.listen(). The previous container keeps serving; this container never becomes
 * healthy, making the failed migration visible in deploy logs rather than silently corrupting state.
 */
export async function runMigrations(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    logger.log('DATABASE_URL not set — skipping migrations');
    return;
  }

  const migrationsFolder =
    process.env['MIGRATIONS_DIR'] ?? join(__dirname, '..', 'drizzle');

  logger.log(`Running migrations from: ${migrationsFolder}`);

  const pool = new Pool({ ...buildPoolConfig(url) });
  const db = drizzle(pool);

  try {
    await migrate(db, { migrationsFolder });
    logger.log('Migrations completed successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('================================================================================');
    logger.error('MIGRATION FAILED — aborting boot to prevent serving against a broken schema');
    logger.error(`Error: ${message}`);
    logger.error('================================================================================');
    throw err;
  } finally {
    await pool.end();
  }
}
