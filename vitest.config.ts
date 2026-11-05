import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // The seeded self-play soaks (fuzzHarness, heuristicSoak) run 10-20 s of
    // synchronous engine work in one test. vitest 2 never enforced its 5 s
    // default on a test that does not yield to the event loop; later majors do
    // (intent 56), so the default is raised rather than each soak edited.
    testTimeout: 60_000,
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'e2e/**/*.test.ts', 'scripts/**/*.test.mjs', 'tools/**/*.test.mjs'],
  },
});
