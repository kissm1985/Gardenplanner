import { defineConfig, devices } from '@playwright/test';

/** Database of the e2e backend (outside test-results, which Playwright clears at start). */
export const BACKEND_DB = 'node_modules/.cache/planterra-e2e.db';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  // Tests start with the intro already seen; intro.spec.ts clears it.
  // Hungarian browser: the app follows the browser language unless one is chosen.
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', storageState: 'tests/e2e/intro-done.json', locale: 'hu-HU' },
  webServer: [
    { command: 'npm run build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true, timeout: 120_000 },
    // The Pro backend with one nursery, serving the same build (tests/e2e/backend.spec.ts).
    {
      command: `mkdir -p node_modules/.cache && rm -f ${BACKEND_DB}* && npx tsx server/cli.ts create-tenant zoldkert "Zöld Kert Kertészet" tulaj@zoldkert.hu && npx tsx server/main.ts`,
      port: 8787,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { DB_PATH: BACKEND_DB, PORT: '8787', STATIC_DIR: 'dist', PUBLIC_URL: 'http://localhost:8787' },
    },
  ],
  projects: [
    // Pixel 7 uses Chromium; the preinstalled browser is Chromium only.
    { name: 'mobile', use: { ...devices['Pixel 7'], locale: 'hu-HU' } },
  ],
});
