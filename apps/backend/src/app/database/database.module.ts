import { Module, Logger, OnModuleDestroy, Global } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');

export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: (): { db: Database | null; pool: Pool | null } => {
        const logger = new Logger('Database');
        const url = process.env['DATABASE_URL'];
        if (!url) {
          logger.warn('DATABASE_URL not set — DB features disabled (e2e/local dev mode)');
          return { db: null, pool: null };
        }
        const pool = new Pool({
          connectionString: url,
          max: 10,
          idleTimeoutMillis: 30_000,
        });
        pool.on('error', (err) => logger.error(`Pool error: ${err.message}`));
        logger.log('Postgres pool initialized');
        const db = drizzle(pool, { schema });
        return { db, pool };
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    // Pool cleanup happens via the provider's lifecycle when the app shuts down.
  }
}
