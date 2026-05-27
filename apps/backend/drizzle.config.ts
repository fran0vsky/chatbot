import 'dotenv/config';
import type { Config } from 'drizzle-kit';

const url = process.env['DATABASE_URL'];
if (!url) {
  throw new Error('DATABASE_URL must be set to generate or push migrations');
}

export default {
  schema: './src/app/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
} satisfies Config;
