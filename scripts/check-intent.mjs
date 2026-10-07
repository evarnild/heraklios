#!/usr/bin/env node
// `npm run check:intent [-- <branch>] [--base <ref>]`
//
// Verifies the current change carries an intent id, that its intents/<id>-*/
// folder holds what the declared type requires, that the required gates are
// recorded, and that the change's shape matches the declared type.
// Exit code: 0 PASS, 2 ROUTE (type does not fit — take the fuller path), 1 FAIL.
// The rules themselves live in intent-check-lib.mjs.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkChange, formatResult, parseBranch, parseMetadata } from './intent-check-lib.mjs';

const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const base = baseIdx >= 0 ? args[baseIdx + 1] : 'main';
const positional = args.filter((a, i) => !a.startsWith('--') && i !== baseIdx + 1);
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

const branch = positional[0] ?? git('rev-parse', '--abbrev-ref', 'HEAD');
const parsed = parseBranch(branch);

let intentDir = null;
let metadata = null;
let intentFiles = [];
if (parsed && existsSync('intents')) {
  const dir = readdirSync('intents').find((d) => d.startsWith(`${parsed.id}-`));
  if (dir) {
    intentDir = `intents/${dir}`;
    intentFiles = readdirSync(intentDir);
    const meta = join(intentDir, 'metadata.yml');
    if (existsSync(meta)) metadata = parseMetadata(readFileSync(meta, 'utf8'));
  }
}

// Committed and uncommitted changes since the branch left `base`.
const mergeBase = git('merge-base', base, positional[0] ?? 'HEAD');
const numstat = positional[0] ? git('diff', '--numstat', mergeBase, positional[0]) : git('diff', '--numstat', mergeBase);
const diff = numstat
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [a, d, path] = line.split('\t');
    // Binary files report "-"; count them as one line so they are not invisible.
    return { path, added: a === '-' ? 1 : Number(a), deleted: d === '-' ? 0 : Number(d) };
  });

const result = checkChange({ branch, metadata, intentDir, intentFiles, diff });
const { verdict, text } = formatResult(result);
console.log(text);
process.exit(verdict === 'FAIL' ? 1 : verdict === 'ROUTE' ? 2 : 0);
