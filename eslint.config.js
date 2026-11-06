// ESLint flat config. Two layers:
//
// 1. Correctness rules (eslint + typescript-eslint recommended) — errors.
// 2. Agent guardrails from the AI coding guidelines (file length, function
//    length, complexity, parameter count) — warnings, because existing files
//    such as BoardScene.ts predate them. `npm run lint` caps the warning
//    count at the current baseline (see package.json), so new violations
//    fail `npm run verify` while the old ones are paid down. The cap counts
//    warnings, not locations — when you remove warnings, lower the cap in
//    the same commit, or a later change can quietly spend the slack.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Architecture import boundaries (§61, docs/architecture.md principles 1-4).
// `no-restricted-imports` options REPLACE rather than merge when two config
// blocks match one file, so the layer blocks below are disjoint and each
// carries the shared tooling/server patterns itself. The patterns match the
// import string as written, so `**/x/**` covers any relative depth.
const noTooling = {
  group: ['**/scripts/**', '**/tools/**'],
  message: 'The game never imports tooling (principle 4).',
};
const noMapEditor = {
  group: ['**/map-editor/**'],
  message: 'src/map-editor is a top layer beside scenes; nothing imports it (principle 2).',
};
const noScenes = {
  group: ['**/scenes/**'],
  message: 'Dependencies point one way: scenes -> ui -> engine -> data (principle 2).',
};
const noUi = {
  group: ['**/ui/**'],
  message: 'Engine and data never import ui (principles 1, 2).',
};
const noServer = {
  group: ['**/server/**'],
  message: 'The game never imports the save server (principle 3).',
};
const noPhaser = {
  group: ['phaser', 'phaser/**'],
  message: 'Phaser is presentation only (principle 1).',
};
const noEngine = {
  group: ['**/engine/**'],
  message: 'Data is the bottom layer (principle 2).',
};
const restrict = (...patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.claude/',
      '.codex/',
      'tools/map-extract/',
      '**/*.tsbuildinfo',
      'test-results/',
      'playwright-report/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Guardrails (AI Coding & Agent Usage Guidelines §1.8).
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 20],
      'max-params': ['warn', 7],
      'max-depth': ['warn', 4],
      // Guidelines: no raw console writes outside deliberate, annotated spots.
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: restrict(noPhaser, noUi, noScenes, noMapEditor, noServer, noTooling),
  },
  {
    files: ['src/data/**/*.ts'],
    rules: restrict(noPhaser, noUi, noScenes, noMapEditor, noServer, noEngine, noTooling),
  },
  {
    files: ['src/ui/**/*.ts'],
    rules: restrict(noScenes, noMapEditor, noServer, noTooling),
  },
  {
    files: ['src/scenes/**/*.ts'],
    rules: restrict(noMapEditor, noServer, noTooling),
  },
  {
    // The map editor is plain Canvas 2D, a top layer beside scenes: it may
    // import ui, engine and data (it reuses ui/hexRender).
    files: ['src/map-editor/**/*.ts'],
    rules: restrict(noScenes, noPhaser, noServer, noTooling),
  },
  {
    files: ['src/*.ts'],
    rules: restrict(noServer, noTooling),
  },
  {
    // The server only stores (principle 3): of the game it may import only
    // engine/saveGame. Test files build fixtures and are exempt.
    files: ['server/**/*.ts'],
    ignores: ['server/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noPhaser,
            {
              regex: '(^|/)src/(?!engine/saveGame([.]ts|[.]js)?$)',
              message: 'The server may import only src/engine/saveGame (principle 3).',
            },
          ],
        },
      ],
    },
  },
  {
    // Tests are long `describe` blocks by nature; the function-length and
    // file-length guardrails measure nothing useful there.
    files: ['**/*.test.ts', '**/*.test.mjs'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    // CLI scripts report on stdout; printing is their job.
    files: ['scripts/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // The orchestrator's CLI entry reports on stdout/stderr like a script (§52).
    files: ['tools/orchestrator/orchestrator.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Generated by the map editor / tools/map-extract — not hand-written.
    files: ['src/data/map.ts'],
    rules: {
      'max-lines': 'off',
    },
  },
);
