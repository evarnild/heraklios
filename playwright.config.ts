// `npm run e2e` — the browser smoke suite (intents/32-e2e-smoke-suite).
// Separate from `npm run verify`: it needs a browser install
// (`npx playwright install chromium`, once per machine) and a dev server.
import { defineConfig } from '@playwright/test';

/** 5200 + (32 mod 100), the `spawn` port rule, so it never meets another session's server. */
const PORT = 5232;
const HOST = '127.0.0.1';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
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
  },
});
