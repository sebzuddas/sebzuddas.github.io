import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 45_000,
  use: { baseURL: 'http://localhost:4329' },
  webServer: {
    command: 'npx astro preview --port 4329 --ignore-lock',
    url: 'http://localhost:4329',
    reuseExistingServer: true,
  },
});
