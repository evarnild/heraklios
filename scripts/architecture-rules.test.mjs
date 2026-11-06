// Proof that each import-boundary rule in eslint.config.js (§61, B3 to B6)
// fires on a forbidden import and stays quiet on an allowed one. It lints
// fixture strings through ESLint's Node API with the repository's own config,
// so deleting a block or a pattern from eslint.config.js fails a case here.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let eslint;

beforeAll(() => {
  eslint = new ESLint({ cwd: root });
});

async function restrictedImportErrors(file, importPath) {
  const code = `import * as x from '${importPath}';\nexport default x;\n`;
  const [result] = await eslint.lintText(code, { filePath: path.join(root, file) });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports' && m.severity === 2);
}

// [file, import string, why]
const forbidden = [
  ['src/engine/x.ts', 'phaser', 'engine imports phaser'],
  ['src/engine/x.ts', '../ui/hexRender', 'engine imports ui'],
  ['src/engine/x.ts', '../../ui/hexRender', 'engine imports ui, two levels'],
  ['src/engine/x.ts', '../scenes/BoardScene', 'engine imports scenes'],
  ['src/engine/x.ts', '../map-editor/editorState', 'engine imports map-editor'],
  ['src/engine/x.ts', '../../server/saveApi', 'engine imports the server'],
  ['src/engine/x.ts', '../../scripts/ship-lib.mjs', 'engine imports scripts'],
  ['src/engine/x.ts', '../../tools/orchestrator/x.mjs', 'engine imports tools'],
  ['src/data/x.ts', 'phaser', 'data imports phaser'],
  ['src/data/x.ts', '../ui/hexRender', 'data imports ui'],
  ['src/data/x.ts', '../scenes/BoardScene', 'data imports scenes'],
  ['src/data/x.ts', '../map-editor/editorState', 'data imports map-editor'],
  ['src/data/x.ts', '../engine/hex', 'data imports engine'],
  ['src/data/x.ts', '../../engine/hex', 'data imports engine, two levels'],
  ['src/data/x.ts', '../../scripts/ship-lib.mjs', 'data imports scripts'],
  ['src/ui/x.ts', '../scenes/BoardScene', 'ui imports scenes'],
  ['src/ui/x.ts', '../../scenes/BoardScene', 'ui imports scenes, two levels'],
  ['src/ui/x.ts', '../map-editor/editorState', 'ui imports map-editor'],
  ['src/ui/x.ts', '../../tools/orchestrator/x.mjs', 'ui imports tools'],
  ['src/scenes/x.ts', '../map-editor/editorState', 'scenes import map-editor'],
  ['src/scenes/x.ts', '../../scripts/ship-lib.mjs', 'scenes import scripts'],
  ['src/map-editor/x.ts', '../scenes/BoardScene', 'map-editor imports scenes'],
  ['src/map-editor/x.ts', 'phaser', 'map-editor imports phaser'],
  ['src/map-editor/x.ts', '../../scripts/ship-lib.mjs', 'map-editor imports scripts'],
  ['src/main.ts', '../scripts/ship-lib.mjs', 'src root imports scripts'],
  ['server/saveApi.ts', '../src/engine/state', 'server imports engine/state'],
  ['server/saveApi.ts', '../src/data/units', 'server imports data'],
  ['server/saveApi.ts', '../src/ui/session', 'server imports ui'],
  ['server/saveApi.ts', '../src/engine/saveGameExtra', 'server imports a lookalike of saveGame'],
  ['server/saveApi.ts', 'phaser', 'server imports phaser'],
];

const allowed = [
  ['src/engine/x.ts', './hex', 'engine imports engine'],
  ['src/engine/x.ts', '../data/units', 'engine imports data'],
  ['src/data/x.ts', './terrain', 'data imports data'],
  ['src/ui/x.ts', '../engine/hex', 'ui imports engine'],
  ['src/ui/x.ts', '../data/units', 'ui imports data'],
  ['src/ui/x.ts', 'phaser', 'ui imports phaser'],
  ['src/scenes/x.ts', '../ui/MapView', 'scenes import ui'],
  ['src/scenes/x.ts', '../engine/hex', 'scenes import engine'],
  ['src/scenes/x.ts', 'phaser', 'scenes import phaser'],
  ['src/map-editor/x.ts', '../ui/hexRender', 'map-editor imports ui/hexRender'],
  ['src/map-editor/x.ts', '../engine/hex', 'map-editor imports engine'],
  ['src/map-editor/x.ts', '../data/map', 'map-editor imports data'],
  ['server/saveApi.ts', '../src/engine/saveGame', 'server imports engine/saveGame'],
  ['server/saveApi.ts', '../src/engine/saveGame.ts', 'server imports engine/saveGame.ts'],
  ['server/saveApi.ts', './fileSaveFs', 'server imports itself'],
  ['server/x.test.ts', '../src/engine/state', 'server tests import engine/state (fixtures)'],
  ['server/x.test.ts', '../src/engine/army', 'server tests import engine/army (fixtures)'],
];

describe('import-boundary rules (eslint.config.js)', () => {
  it.each(forbidden)('%s importing %s is an error (%s)', async (file, spec) => {
    const errors = await restrictedImportErrors(file, spec);
    expect(errors).toHaveLength(1);
  }, 60_000);

  it.each(allowed)('%s importing %s is allowed (%s)', async (file, spec) => {
    const errors = await restrictedImportErrors(file, spec);
    expect(errors).toEqual([]);
  }, 60_000);
});
