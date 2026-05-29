// Nx spawns project commands with a lowercase-drive cwd (e.g. `c:\...`). On
// Windows that makes Vitest's worker fail to bind its loaded config to the
// discovered test files, surfacing as "Cannot read properties of undefined
// (reading 'config')" and "no tests". Re-invoking Vitest from this project
// directory with an uppercase drive letter makes the run stable. No-op on
// POSIX, where paths never start with a drive letter.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const upperDrive = (p) => p.replace(/^([a-z]):/, (_, d) => `${d.toUpperCase()}:`);

const projectDir = upperDrive(dirname(fileURLToPath(import.meta.url)));
const binName = process.platform === 'win32' ? 'vitest.cmd' : 'vitest';
const vitestBin = join(projectDir, '..', '..', 'node_modules', '.bin', binName);

const result = spawnSync(vitestBin, ['run', ...process.argv.slice(2)], {
  cwd: projectDir,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
