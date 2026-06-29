import 'dotenv/config';
import type { Config } from 'drizzle-kit';

// `drizzle-kit generate` runs fully offline — it diffs schema.ts against the
// committed snapshot in ./drizzle/meta and never opens a connection. So we must
// NOT hard-fail when DATABASE_URL is unset, otherwise the CI drift-check and a
// plain `npm run db:generate` can't run without a live DB. A placeholder keeps
// the config type-valid; `push`/`migrate` (which DO connect) fail fast with a
// clear ECONNREFUSED if this placeholder is ever left in place.
const url =
  process.env['DATABASE_URL'] ??
  'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default {
  schema: './src/app/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
} satisfies Config;
