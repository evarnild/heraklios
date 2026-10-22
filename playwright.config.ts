// `npm run e2e` — the browser smoke suite (intents/32-e2e-smoke-suite).
// Separate from `npm run verify`: it needs a browser install
// (`npx playwright install chromium`, once per machine) and a dev server.
import { defineConfig } from '@playwright/test';
import { SAVES_DIR } from './e2e/savesDir';

/** 5200 + (32 mod 100), the `spawn` port rule, so it never meets another session's server. */
const PORT = 5232;
const HOST = '127.0.0.1';

export default defineConfig({
  testDir: 'e2e',
  // Scenarios are *.spec.ts only: the *.test.ts files in e2e/ are vitest unit tests.
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 30_000,
  // Two workers, not Playwright's default (half the 20 threads here = 5):
  // with 5 parallel Chromiums (software GL, SwiftShader) every step slowed
  // from ~50 ms to 0.4-2 s and scenarios hit the 30 s timeout: 6 of 7 runs
  // red; with 1, 2 or 3 workers 9 of 9 runs were green (16-31 s). §41.
  workers: 2,
  // A failure names its scenario and assertion in the terminal and keeps a
  // trace; a pass costs nothing extra (§38). A red run on Windows also says
  // whether the machine slept during it (scripts/sleep-reporter.mjs, §41).
  reporter: [['list'], ['./scripts/sleep-reporter.mjs']],
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    // The game's own size (1100×750); the HUD is laid out for it.
    viewport: { width: 1100, height: 750 },
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host ${HOST}`,
    url: `http://${HOST}:${PORT}`,
    // Never reuse a server already on the port: it could be another
    // checkout's, serving other code. A taken port fails the run instead.
    reuseExistingServer: false,
    // The save API writes here, never into the checkout's saves/ (§45 B10).
    env: { HERAKLIOS_SAVES_DIR: SAVES_DIR },
  },
});
