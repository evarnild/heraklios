#!/usr/bin/env node
// `npm run ship -- <id> [--live-checked "<owner's words>"] [--dry-run] [--cleanup] [--trailer "<line>"]...`
//
// Ships a reviewed intent the way REVIEW-POLICY.md → "Merging" says: record the
// live check (only on the owner's word), check the merge preconditions from
// git, merge --no-ff with the message from a file, `npm run verify` on main,
// the bookkeeping commit, push, then remove the worktree and delete the
// branch. It stops at the first step that fails and names it; run again and
// it resumes (every step first checks whether it is already done). The
// decisions live in ship-lib.mjs; this file is the git half. Spec: intents/46-ship-skill/spec.md.
//
// Run it from the main checkout, on main. It never forces, resets, deletes with
// -D, stages anything but the files a step wrote, or stops a process.
//
// Test seam, not an option: HERAKLIOS_SHIP_VERIFY, a command line that runs in
// place of `npm run verify` (ship.test.mjs sets it in a throwaway repository).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGate, parseMetadata, parseReviewHeader } from './intent-check-lib.mjs';
import { appendEvent, findIntentDir, git, mainCheckout, readIntentMetadataFromBranch } from './session-io.mjs';
import { branchFor, parseWorktreeList, pathKey } from './session-lib.mjs';
import {
  checkPreconditions,
  commitMessage,
  isBookkept,
  markLiveChecked,
  markMerged,
  mergeMessage,
  moveRowToShipped,
  planSteps,
  routeReasonStated,
  shippedRow,
} from './ship-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CHECK_INTENT = join(here, 'check-intent.mjs');
const SPAWN = join(here, 'spawn-intent.mjs');

class Stop extends Error {
  constructor(step, message) {
    super(message);
    this.step = step;
  }
}

function parseShipArgs(argv) {
  const out = { id: null, liveChecked: null, dryRun: false, cleanup: false, trailers: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live-checked') out.liveChecked = argv[++i] ?? '';
    else if (a === '--trailer') out.trailers.push(argv[++i] ?? '');
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--cleanup') out.cleanup = true;
    else if (/^\d+$/.test(a) && out.id === null) out.id = a;
    else throw new Error(`unexpected argument "${a}"`);
  }
  return out;
}

const gitOk = (cwd, ...args) => {
  try {
    git(cwd, ...args);
    return true;
  } catch {
    return false;
  }
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const errText = (e) => (e.stderr?.toString().trim() || e.stdout?.toString().trim() || e.message).trim();

/** Runs `fn(path)` with `text` in a temporary file (messages go by -F, never by stdin: the §35 slip). */
function withMessageFile(text, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'ship-msg-'));
  const file = join(dir, 'message.txt');
  writeFileSync(file, text);
  try {
    return fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Commits exactly `paths` (pathspec form: anything else staged by another session stays out). */
function commitPaths(cwd, paths, message) {
  git(cwd, 'add', '--', ...paths);
  withMessageFile(message, (file) => git(cwd, 'commit', '-q', '-F', file, '--', ...paths));
  return git(cwd, 'rev-parse', '--short', 'HEAD');
}

// ---- inspecting the repository ------------------------------------------------

function worktreeOf(root, branch) {
  return parseWorktreeList(git(root, 'worktree', 'list', '--porcelain')).find(
    (w) => w.branch === branch && pathKey(w.path) !== pathKey(root),
  );
}

/** What the run needs to know about intent `id`, from git. Stops if it can't be found. */
function locate(root, id) {
  const onBranch = readIntentMetadataFromBranch(root, id);
  if (onBranch) {
    const { dir, metadata, branch } = onBranch;
    return { dir, metadata, branch, branchExists: true };
  }
  // The branch is gone: valid only for a run resuming after the merge.
  const dir = findIntentDir(root, id);
  const file = dir && join(root, dir, 'metadata.yml');
  if (!file || !existsSync(file)) throw new Stop('start', `no branch and no intents/${id}-*/ on main: nothing to ship for §${id}.`);
  const metadata = parseMetadata(readFileSync(file, 'utf8'));
  if (!metadata.merged) throw new Stop('start', `the branch for §${id} does not exist and main has no merged: record for it.`);
  return { dir, metadata, branch: branchFor({ type: metadata.type, id, slug: metadata.slug }), branchExists: false };
}

/** B4: the intent's folder on main has no uncommitted changes (another session's work: never committed as ours). */
function checkMetadataClean(root, loc) {
  const dirty = git(root, 'status', '--porcelain', '--', loc.dir);
  if (dirty) throw new Stop('start', `${loc.dir} has uncommitted changes on main (another session's work?). Commit or discard them, then re-run:
${dirty}`);
}

/** B4: the root plan.md has no uncommitted changes. Its own check so it can go when the queue view is generated (§47). */
function checkPlanClean(root) {
  const dirty = git(root, 'status', '--porcelain', '--', 'plan.md');
  if (dirty) throw new Stop('start', `plan.md has uncommitted changes on main (another session's work?). Commit or discard them, then re-run:
${dirty}`);
}

/** Step B4: where it runs and what must be clean. */
function checkStart(root, id, loc) {
  if (pathKey(git(process.cwd(), 'rev-parse', '--show-toplevel')) !== pathKey(root)) {
    throw new Stop('start', `run from the main checkout (${root}), not from a worktree.`);
  }
  const current = git(root, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (current !== 'main') throw new Stop('start', `the main checkout is on "${current}", not main.`);
  checkMetadataClean(root, loc);
  checkPlanClean(root);
  if (!gitOk(root, 'remote', 'get-url', 'origin')) throw new Stop('start', 'main has no remote named origin to push to.');
}

function readState(root, id, loc, opts) {
  const merged = !loc.branchExists || gitOk(root, 'merge-base', '--is-ancestor', loc.branch, 'main');
  const wt = loc.branchExists ? worktreeOf(root, loc.branch) : undefined;
  let bookkept = false;
  if (merged && existsSync(join(root, loc.dir, 'metadata.yml'))) {
    const meta = parseMetadata(readFileSync(join(root, loc.dir, 'metadata.yml'), 'utf8'));
    bookkept = isBookkept(meta, readFileSync(join(root, 'plan.md'), 'utf8'), id);
  }
  gitOk(root, 'fetch', '-q', 'origin');
  const originMain = (() => {
    try {
      return git(root, 'rev-parse', '--verify', '-q', 'origin/main');
    } catch {
      return null;
    }
  })();
  return {
    wt,
    state: {
      liveCheckRequested: opts.liveChecked !== null,
      liveCheckRecorded: parseGate(loc.metadata.live_checked).state === 'recorded',
      merged,
      bookkept,
      // Not "pushed" before the bookkeeping commit: main will still move.
      pushed: bookkept && originMain !== null && originMain === git(root, 'rev-parse', 'main'),
      cleanedUp: !wt && !loc.branchExists,
    },
  };
}

// ---- preconditions ------------------------------------------------------------

function readReview(root, branch, dir) {
  try {
    const text = git(root, 'show', `${branch}:${dir}/review.md`);
    return { text, header: parseReviewHeader(text) };
  } catch {
    return { text: '', header: null };
  }
}

function preconditionInputs(root, loc) {
  const review = readReview(root, loc.branch, loc.dir);
  const rc = review.header?.['reviewed-commit'];
  const isAncestor = !!rc && gitOk(root, 'merge-base', '--is-ancestor', rc, loc.branch);
  const changedFiles = isAncestor ? git(root, 'diff', '--name-only', rc, loc.branch).split(/\r?\n/).filter(Boolean) : [];
  return { reviewHeader: review.header, isAncestor, changedFiles, intentDir: loc.dir, reviewText: review.text };
}

function runCheckIntent(root, branch, reviewText) {
  const r = spawnSync(process.execPath, [CHECK_INTENT, branch], { cwd: root, encoding: 'utf8' });
  const verdict = r.status === 0 ? 'PASS' : r.status === 2 ? 'ROUTE' : 'FAIL';
  return { verdict, reasonStated: routeReasonStated(reviewText), output: (r.stdout || r.stderr || '').trim() };
}

/** Evaluates preconditions; `withCheck` false evaluates the review part only (before anything is written). */
function evaluatePreconditions(root, loc, withCheck) {
  const input = preconditionInputs(root, loc);
  const checkIntent = withCheck ? runCheckIntent(root, loc.branch, input.reviewText) : undefined;
  const result = checkPreconditions({ ...input, checkIntent });
  return { result, checkIntent };
}

// ---- steps --------------------------------------------------------------------

function recordLiveCheck(root, loc, wt, opts, trailers) {
  if (!wt) throw new Stop('live-check', `${loc.branch} has no worktree to commit the live check in. Spawn one (npm run spawn -- ${loc.metadata.id}) or record live_checked: by hand.`);
  const file = join(wt.path, loc.dir, 'metadata.yml');
  if (git(wt.path, 'status', '--porcelain', '--', `${loc.dir}/metadata.yml`)) {
    throw new Stop('live-check', `${loc.dir}/metadata.yml has uncommitted changes in ${wt.path}.`);
  }
  writeFileSync(file, markLiveChecked(readFileSync(file, 'utf8'), today(), opts.liveChecked));
  const hash = commitPaths(wt.path, [`${loc.dir}/metadata.yml`], commitMessage(`§${loc.metadata.id}: live check recorded (on the owner's word)`, trailers));
  return `recorded live_checked: ${today()} by-agent on ${loc.branch} (${hash})`;
}

function mergeBranch(root, loc, trailers) {
  const before = git(root, 'rev-parse', 'HEAD');
  try {
    withMessageFile(mergeMessage(loc.metadata.id, loc.metadata.title, trailers), (file) =>
      git(root, 'merge', '--no-ff', loc.branch, '-F', file),
    );
  } catch (e) {
    gitOk(root, 'merge', '--abort'); // leaves main as it was; nothing of anyone's work is dropped
    throw new Stop('merge', `git merge failed (main left at ${before.slice(0, 7)}): ${errText(e)}`);
  }
  return git(root, 'rev-parse', 'HEAD');
}

function runVerify(root) {
  const command = process.env.HERAKLIOS_SHIP_VERIFY || 'npm run verify';
  const r = spawnSync(command, { cwd: root, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status === 0) return `\`${command}\` is green on main`;
  const tail = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split(/\r?\n/).slice(-25).join('\n');
  throw new Stop('verify', `\`${command}\` failed on main AFTER the merge. Nothing was undone, pushed or removed; undoing a merge is the owner's call.\n${tail}`);
}

/** The merge commit of `branch` on main: the commit whose second parent is the branch tip. */
function findMergeCommit(root, branch) {
  const tip = git(root, 'rev-parse', branch);
  const lines = git(root, 'rev-list', '--merges', '--parents', '--ancestry-path', `${tip}..main`).split(/\r?\n/).filter(Boolean);
  const found = lines.map((l) => l.split(' ')).filter((p) => p[2] === tip);
  if (!found.length) throw new Stop('bookkeeping', `cannot find the merge commit of ${branch} on main (was it merged without --no-ff?).`);
  return found.at(-1)[0];
}

/**
 * The plan.md half of the bookkeeping: the intent's row moves to Shipped. Kept
 * apart from the metadata.yml half (and called from one place) so that it can
 * be dropped when the queue becomes a generated view (§47). Returns the files it wrote.
 */
function bookkeepPlan(root, loc, hash) {
  const id = loc.metadata.id;
  const review = readReview(root, loc.branch, loc.dir).header ?? {};
  const meta = loc.metadata;
  const row = shippedRow({ id, slug: meta.slug, title: meta.title, type: meta.type, tier: review.tier, rounds: review.round ?? '1', hash });
  const planFile = join(root, 'plan.md');
  writeFileSync(planFile, moveRowToShipped(readFileSync(planFile, 'utf8'), id, row));
  return ['plan.md'];
}

/** The metadata.yml half: `merged:` and `status: done`. */
function bookkeepMetadata(root, loc, hash) {
  const metaFile = join(root, loc.dir, 'metadata.yml');
  writeFileSync(metaFile, markMerged(readFileSync(metaFile, 'utf8'), hash, today()));
  return [`${loc.dir}/metadata.yml`];
}

function bookkeeping(root, loc, trailers) {
  const id = loc.metadata.id;
  const hash = findMergeCommit(root, loc.branch).slice(0, 7);
  const files = [...bookkeepMetadata(root, loc, hash), ...bookkeepPlan(root, loc, hash)];
  const commit = commitPaths(root, files, commitMessage(`§${id}: merged (${hash}); status done, plan.md row to Shipped`, trailers));
  return `merged: ${hash}, status done, plan.md row moved to Shipped (${commit})`;
}

function push(root) {
  const before = gitOk(root, 'rev-parse', '--verify', '-q', 'origin/main') ? git(root, 'rev-parse', '--short', 'origin/main') : 'new';
  try {
    git(root, 'push', 'origin', 'main');
  } catch (e) {
    throw new Stop('push', `git push origin main was rejected: ${errText(e)} (never forced; fetch, look at origin/main, then re-run).`);
  }
  return `pushed origin/main ${before}..${git(root, 'rev-parse', '--short', 'main')}`;
}

/** Step 7. Returns report text and whether something is left for the owner. */
function cleanup(root, id, loc) {
  const parts = [];
  const wt = loc.branchExists ? worktreeOf(root, loc.branch) : undefined;
  if (wt) {
    const r = spawnSync(process.execPath, [SPAWN, String(id), '--remove'], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) {
      const why = (r.stderr || r.stdout || '').trim();
      return { text: `could not remove ${wt.path}: ${why}`, left: `exit any session or program using ${wt.path}, then run: npm run ship -- ${id} --cleanup` };
    }
    parts.push(`removed worktree ${wt.path}`);
    if (existsSync(wt.path)) {
      return { text: parts.join('; '), left: `git no longer lists ${wt.path} but the folder is still there (something held it open); delete it by hand, then run: npm run ship -- ${id} --cleanup` };
    }
  }
  if (loc.branchExists && gitOk(root, 'show-ref', '--verify', '--quiet', `refs/heads/${loc.branch}`)) {
    try {
      git(root, 'branch', '-d', loc.branch);
    } catch (e) {
      throw new Stop('remove', `git branch -d ${loc.branch} refused: ${errText(e)}`);
    }
    parts.push(`deleted branch ${loc.branch}`);
  }
  return { text: parts.join('; ') || 'worktree and branch already gone', left: null };
}

// ---- the run ------------------------------------------------------------------

const log = [];
const say = (status, id, text) => log.push(`  ${status.padEnd(8)} ${id.padEnd(13)} ${text}`);

function dryRun(root, loc, steps) {
  for (const s of steps) say(s.status === 'done' || s.status === 'n/a' ? s.status : 'would', s.id, s.label);
  if (loc.state.merged) return;
  // check:intent would fail only because the live check is not recorded yet; the run records it first.
  const pending = loc.state.liveCheckRequested && !loc.state.liveCheckRecorded;
  const { result, checkIntent } = evaluatePreconditions(root, loc, !pending);
  const note = pending ? ' (review only; check:intent runs after the live check is recorded)' : ` (check:intent ${checkIntent.verdict})`;
  if (result.ok) say('ok', 'preconditions', `hold${note}`);
  else say('WOULD STOP', 'preconditions', `${result.failed}: ${result.message}`);
}

/** Steps 1 to 3: live check, preconditions, merge. Returns nothing; throws Stop. */
function beforeMerge(root, loc, opts, wt) {
  if (loc.state.merged) return say('skipped', 'merge', 'already merged into main');
  // Review-only preconditions first, so a refusal happens before anything is written.
  const first = evaluatePreconditions(root, loc, false).result;
  if (!first.ok) throw new Stop('preconditions', `${first.failed}: ${first.message}`);
  if (opts.liveChecked !== null && !loc.state.liveCheckRecorded) {
    say('done', 'live-check', recordLiveCheck(root, loc, wt, opts, opts.trailers));
  }
  const { result, checkIntent } = evaluatePreconditions(root, loc, true);
  if (!result.ok) throw new Stop('preconditions', `${result.failed}: ${result.message}
${checkIntent?.output ?? ''}`);
  say('done', 'preconditions', `hold (check:intent ${checkIntent.verdict})`);
  say('done', 'merge', `merged ${loc.branch} into main (${mergeBranch(root, loc, opts.trailers).slice(0, 7)})`);
}

/** Steps 4 to 6: verify, bookkeeping, push. */
function afterMerge(root, loc, opts) {
  let moved = false;
  if (loc.state.bookkept) {
    say('skipped', 'bookkeeping', 'already on main');
  } else {
    say('done', 'verify', runVerify(root));
    say('done', 'bookkeeping', bookkeeping(root, loc, opts.trailers));
    moved = true;
  }
  if (loc.state.pushed && !moved) say('skipped', 'push', 'origin/main is already at main');
  else say('done', 'push', push(root));
}

function execute(root, id, loc, opts, wt) {
  if (!opts.cleanup) {
    beforeMerge(root, loc, opts, wt);
    afterMerge(root, loc, opts);
  }
  const c = cleanup(root, id, loc);
  say(c.left ? 'LEFT' : 'done', 'remove', c.text);
  return c.left;
}

function main() {
  let opts;
  try {
    opts = parseShipArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`ship: ${e.message}`);
    process.exit(1);
  }
  if (!opts.id) {
    console.error('usage: npm run ship -- <id> [--live-checked "<owner\'s words>"] [--dry-run] [--cleanup] [--trailer "<line>"]...');
    process.exit(1);
  }
  const root = mainCheckout(process.cwd());
  let step = 'start';
  let left = null;
  try {
    const loc = locate(root, opts.id);
    checkStart(root, opts.id, loc);
    const { wt, state } = readState(root, opts.id, loc, opts);
    loc.state = state;
    if (opts.dryRun) {
      dryRun(root, loc, planSteps(state));
    } else {
      step = 'run';
      left = execute(root, opts.id, loc, opts, wt);
    }
    finish(root, opts, 'shipped', opts.dryRun ? 'dry run' : left ?? 'complete', left);
  } catch (e) {
    const stop = e instanceof Stop ? e : new Stop(step, errText(e));
    say('STOPPED', stop.step, stop.message);
    finish(root, opts, 'ship-stopped', `${stop.step}: ${stop.message.split('\n')[0]}`, null, true);
  }
}

function finish(root, opts, event, detail, left, failed = false) {
  const title = opts.dryRun ? `§${opts.id} dry run (nothing changed)` : `§${opts.id} ${failed ? 'ship stopped' : 'ship report'}`;
  console.log([title, ...log].join('\n'));
  if (left) console.log(`\nLeft for you: ${left}`);
  if (!opts.dryRun) {
    try {
      appendEvent(root, { event, id: String(opts.id), detail: detail.slice(0, 200) });
    } catch {
      // the log is a convenience; a missing one must not hide the report
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
