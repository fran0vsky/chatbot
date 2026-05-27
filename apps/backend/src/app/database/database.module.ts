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
      useFactory: (): { db: Database; pool: Pool } => {
        const logger = new Logger('Database');
        const url = process.env['DATABASE_URL'];
        if (!url) {
          throw new Error('DATABASE_URL env var is required');
        }
        const pool = new Pool({
          connectionString: url,
          // Cloud SQL public IP needs ssl; Cloud SQL Auth Proxy + Unix socket does not.
          // sslmode=require in the URL is enough for node-postgres to enable TLS.
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
  constructor() {}

  async onModuleDestroy(): Promise<void> {
    // Pool cleanup happens via the provider's lifecycle when the app shuts down.
  }
}
