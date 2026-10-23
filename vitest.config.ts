import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'e2e/**/*.test.ts', 'scripts/**/*.test.mjs', 'tools/**/*.test.mjs'],
  },
});
