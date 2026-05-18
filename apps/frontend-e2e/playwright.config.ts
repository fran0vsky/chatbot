import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npx nx run frontend:serve',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      cwd: workspaceRoot,
      timeout: 120_000,
    },
    {
      command: 'npx nx run backend:serve',
      url: 'http://localhost:3000/api',
      reuseExistingServer: !process.env['CI'],
      cwd: workspaceRoot,
      timeout: 120_000,
    },
  ],
  projects: process.env['CI']
    ? [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ],
});
