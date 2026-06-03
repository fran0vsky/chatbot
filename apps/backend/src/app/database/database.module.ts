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
        // Cloud SQL's public-IP endpoint serves a cert signed by a per-instance
        // CA that isn't in the local trust store. Node's pg now treats
        // `sslmode=require` as verify-full, so a raw connection fails locally
        // with "unable to verify the first certificate". We encrypt but skip CA
        // verification, and strip the ssl query params so this explicit `ssl`
        // option actually takes effect (the connection-string's sslmode would
        // otherwise override it back to verify-full). Unix-socket connections
        // (prod via the Cloud SQL connector) use no TLS, so leave those as-is.
        const isUnixSocket = url.includes('/cloudsql/') || url.includes('host=/');
        const connectionString = isUnixSocket
          ? url
          : url.replace(/([?&])(sslmode|uselibpqcompat)=[^&]*/g, '').replace(/[?&]$/, '');
        const pool = new Pool({
          connectionString,
          max: 10,
          idleTimeoutMillis: 30_000,
          ssl: isUnixSocket ? undefined : { rejectUnauthorized: false },
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
