#!/usr/bin/env node
// `npm run check:intent [-- <branch>] [--base <ref>]`
//
// Verifies a change carries an intent id, that its intents/<id>-*/ folder
// holds what the declared type requires, that the required gates are
// recorded, and that the change's shape matches the declared type.
// Exit code: 0 PASS, 2 ROUTE (type does not fit — take the fuller path), 1 FAIL.
// The rules themselves live in intent-check-lib.mjs.
//
// Without <branch>: checks the working tree — committed, uncommitted and
// untracked changes since the merge base — against the working tree's intents/.
// With <branch>: checks that branch's commits against that branch's intents/,
// read from git, so it can run from any checkout.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { checkChange, formatResult, parseArgs, parseBranch, parseMetadata, parseReviewHeader } from './intent-check-lib.mjs';
import { budgetVerdict, checkBudget, countLines, isBudgeted, parseCatFileBatch } from './size-budget-lib.mjs';

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (e) {
  console.error(`check-intent: ${e.message}`);
  process.exit(1);
}
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const fromBranch = opts.branch !== null;
const branch = opts.branch ?? git('rev-parse', '--abbrev-ref', 'HEAD');
if (fromBranch) {
  try {
    git('rev-parse', '--verify', '--quiet', `${branch}^{commit}`);
  } catch {
    console.error(`check-intent: no such branch or commit "${branch}"`);
    process.exit(1);
  }
}
const parsed = parseBranch(branch);

/** The intents/ listing and file reader, from the named branch or the working tree. */
const source = fromBranch
  ? {
      dirs: () => git('ls-tree', '--name-only', `${branch}:intents`).split('\n').filter(Boolean),
      files: (dir) => git('ls-tree', '--name-only', `${branch}:${dir}`).split('\n').filter(Boolean),
      read: (path) => git('show', `${branch}:${path}`),
    }
  : {
      dirs: () => (existsSync('intents') ? readdirSync('intents') : []),
      files: (dir) => readdirSync(dir),
      read: (path) => readFileSync(path, 'utf8'),
    };

let intentDir = null;
let metadata = null;
let intentFiles = [];
let review = null;
if (parsed) {
  let dirs = [];
  try {
    dirs = source.dirs();
  } catch {
    // No intents/ on that branch — checkChange reports the missing folder.
  }
  const dir = dirs.find((d) => d.startsWith(`${parsed.id}-`));
  if (dir) {
    intentDir = `intents/${dir}`;
    intentFiles = source.files(intentDir);
    if (intentFiles.includes('metadata.yml')) metadata = parseMetadata(source.read(`${intentDir}/metadata.yml`));
    if (intentFiles.includes('review.md')) review = parseReviewHeader(source.read(`${intentDir}/review.md`));
  }
}

// --no-renames: a rename would otherwise print as `a/{x => y}.ts`, which no
// path rule can classify.
const mergeBase = git('merge-base', opts.base, fromBranch ? branch : 'HEAD');
const numstat = fromBranch
  ? git('diff', '--numstat', '--no-renames', mergeBase, branch)
  : git('diff', '--numstat', '--no-renames', mergeBase);
const diff = numstat
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [a, d, path] = line.split('\t');
    // Binary files report "-"; count them as one line so they are not invisible.
    return { path, added: a === '-' ? 1 : Number(a), deleted: d === '-' ? 0 : Number(d) };
  });
if (!fromBranch) {
  // A new file nobody has `git add`ed yet is still code arriving before its gate.
  for (const path of git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)) {
    const lines = readFileSync(path, 'utf8').split('\n').length;
    diff.push({ path, added: lines, deleted: 0 });
  }
}

// The size budget (§61, scripts/size-budget-lib.mjs): rules the lint cap can't see.
const BASELINE = 'scripts/size-baseline.json';
const tryGit = (...a) => {
  try {
    return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};
/** Lines of every budgeted file, from the branch's tree or the working tree. */
function measureBudgeted() {
  if (!fromBranch) {
    const tracked = git('ls-files', '--cached', '--others', '--exclude-standard').split('\n');
    const out = {};
    for (const path of tracked.filter((p) => p && isBudgeted(p))) {
      if (existsSync(path)) out[path] = countLines(readFileSync(path, 'utf8'));
    }
    return out;
  }
  const paths = git('ls-tree', '-r', '--name-only', branch).split('\n').filter((p) => p && isBudgeted(p));
  const raw = execFileSync('git', ['cat-file', '--batch'], {
    input: paths.map((p) => `${branch}:${p}\n`).join(''),
    maxBuffer: 256 * 1024 * 1024,
  });
  const texts = parseCatFileBatch(raw, paths.length);
  return Object.fromEntries(paths.map((p, i) => [p, countLines(texts[i] ?? '')]));
}
function checkSizeBudget(type) {
  const branchText = fromBranch ? tryGit('show', `${branch}:${BASELINE}`) : existsSync(BASELINE) ? readFileSync(BASELINE, 'utf8') : null;
  const baseText = tryGit('show', `${mergeBase}:${BASELINE}`);
  if (branchText === null && baseText === null) return { errors: [], routes: [] }; // this branch predates the budget
  const planFile = intentFiles.includes('plan.md') ? source.read(`${intentDir}/plan.md`) : '';
  const failures = checkBudget({
    measured: measureBudgeted(),
    baseline: branchText === null ? {} : JSON.parse(branchText),
    baseBaseline: baseText === null ? null : JSON.parse(baseText),
    planText: planFile,
  });
  return budgetVerdict(failures, type);
}

const result = checkChange({ branch, metadata, intentDir, intentFiles, diff, review });
if (intentDir && result.type) {
  const budget = checkSizeBudget(result.type);
  result.errors.push(...budget.errors);
  result.routes.push(...budget.routes);
}
if (fromBranch && intentDir && git('rev-parse', '--abbrev-ref', 'HEAD') === branch) {
  // Branch mode reads git, so a review.md or live_checked: date still sitting
  // uncommitted in this checkout would be invisible to the merge check
  // (REVIEW-POLICY.md → "Merging": both are committed before it runs).
  const pending = git('status', '--porcelain', '--', `${intentDir}/review.md`, `${intentDir}/metadata.yml`);
  if (pending) {
    result.errors.push(`${intentDir}: review.md or metadata.yml has changes not committed to ${branch}. Commit them, then re-run.`);
  }
}
const { verdict, text } = formatResult(result);
console.log(text);
process.exit(verdict === 'FAIL' ? 1 : verdict === 'ROUTE' ? 2 : 0);
