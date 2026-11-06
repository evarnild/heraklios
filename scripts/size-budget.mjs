#!/usr/bin/env node
// `npm run size:baseline [-- --write]`
//
// Measures every budgeted file (size-budget-lib.mjs → isBudgeted) in the
// working tree and prints the baseline it implies. With --write it writes
// scripts/size-baseline.json: used once at first creation and whenever a
// file shrinks (the ratchet) or a plan states a budget: line. The check is
// `npm run check:intent`.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { baselineFrom, countLines, isBudgeted } from './size-budget-lib.mjs';

export const BASELINE_PATH = 'scripts/size-baseline.json';

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== '--write');
if (unknown.length) {
  console.error(`size-budget: unknown argument ${unknown[0]} (only --write)`);
  process.exit(1);
}

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter((p) => p && isBudgeted(p));
const measured = {};
for (const path of files) {
  try {
    measured[path] = countLines(readFileSync(path, 'utf8'));
  } catch {
    // Listed by git but deleted in the working tree: not present.
  }
}
const text = `${JSON.stringify(baselineFrom(measured), null, 2)}\n`;
if (args.includes('--write')) {
  writeFileSync(BASELINE_PATH, text);
  console.log(`size-budget: wrote ${BASELINE_PATH}`);
} else {
  process.stdout.write(text);
}
