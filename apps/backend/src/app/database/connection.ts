import type { PoolConfig } from 'pg';

/**
 * Build a pg PoolConfig from a DATABASE_URL string.
 *
 * Cloud SQL public-IP notes:
 * - The instance's self-signed CA is not in the system trust store, so we
 *   encrypt but skip CA verification (rejectUnauthorized: false).
 * - `pg` honours `sslmode` from the connection string and would override our
 *   explicit `ssl` option back to verify-full, so we strip `sslmode` and
 *   `uselibpqcompat` params before building the config.
 * - Unix-socket connections (Cloud SQL Auth Proxy / internal socket) use no
 *   TLS — leave those URLs untouched with ssl: undefined.
 */
export function buildPoolConfig(url: string): PoolConfig {
  const isUnixSocket = url.includes('/cloudsql/') || url.includes('host=/');

  if (isUnixSocket) {
    return { connectionString: url, ssl: undefined };
  }

  const connectionString = url
    .replace(/([?&])(sslmode|uselibpqcompat)=[^&]*/g, '')
    .replace(/[?&]$/, '');

  return {
    connectionString,
    ssl: { rejectUnauthorized: false },
  };
}
