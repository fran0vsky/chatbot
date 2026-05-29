import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Normalize a Windows path's drive letter to uppercase. Under this workspace the
 * launching process supplies a lowercase-drive cwd (`c:\...`); Vitest then fails
 * to match its config to the discovered test files and the worker runner context
 * is left undefined ("Cannot read properties of undefined (reading 'config')").
 * Pinning `root` to an uppercase-drive absolute path makes the matching stable.
 * No-op on POSIX (paths there never start with a drive letter).
 */
const upperDrive = (p: string): string =>
  p.replace(/^([a-z]):/, (_, d: string) => `${d.toUpperCase()}:`);

const root = upperDrive(fileURLToPath(new URL('.', import.meta.url)));
const sharedTypes = upperDrive(
  fileURLToPath(new URL('../../libs/shared-types/src/index.ts', import.meta.url)),
);

export default defineConfig({
  root,
  resolve: {
    alias: {
      '@org/shared-types': sharedTypes,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
