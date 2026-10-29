import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  // Tests start with the intro already seen; intro.spec.ts clears it.
  // Hungarian browser: the app follows the browser language unless one is chosen.
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', storageState: 'tests/e2e/intro-done.json', locale: 'hu-HU' },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true, timeout: 120_000 },
  projects: [
    // Pixel 7 uses Chromium; the preinstalled browser is Chromium only.
    { name: 'mobile', use: { ...devices['Pixel 7'], locale: 'hu-HU' } },
  ],
});
