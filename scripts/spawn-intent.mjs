#!/usr/bin/env node
// `npm run spawn -- <id> [--base <ref>] [--no-install]`
// `npm run spawn -- <id> --remove [--unmerged]`
//
// Turns intent <id> into a ready parallel session: a worktree on the intent's
// branch in ../heraklios-wt/<id>-<slug>, its own node_modules (npm ci, never
// a junction; see plan.md §4), a reserved dev port, and a CLAUDE.local.md
// brief the session loads on start. `--remove` takes the worktree down once
// the branch is merged; the branch itself is left for the owner to delete.
// Workflow: CLAUDE.md → "Parallel sessions".
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { appendEvent, git, mainCheckout, readIntentMetadata, readIntentMetadataFromBranch } from './session-io.mjs';
import { branchFor, parseWorktreeList, pathKey, portFor, sessionBrief, worktreePathFor } from './session-lib.mjs';
import { parseBranch } from './intent-check-lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const id = args.find((a, i) => /^\d+$/.test(a) && args[i - 1] !== '--base');

function fail(message) {
  console.error(`spawn: ${message}`);
  process.exit(1);
}

function branchExists(root, branch) {
  try {
    git(root, 'show-ref', '--verify', '--quiet', `refs/heads/${branch}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * An intent drafted in the main checkout but never committed would stay
 * behind as untracked files and block the merge back. Move it with its branch.
 */
function carryIntentFolder(root, dir, path) {
  if (!existsSync(join(root, dir))) return; // read from its branch: nothing in the main checkout to carry
  const tracked = git(root, 'ls-files', '--', dir);
  if (tracked) {
    if (git(root, 'status', '--porcelain', '--', dir)) {
      console.warn(`spawn: ${dir} has uncommitted changes in the main checkout; they are NOT in the worktree.`);
    }
    return;
  }
  if (existsSync(join(path, dir))) {
    console.warn(`spawn: ${dir} exists both on the branch and untracked in the main checkout; left both alone.`);
    return;
  }
  cpSync(join(root, dir), join(path, dir), { recursive: true });
  rmSync(join(root, dir), { recursive: true });
  console.log(`Moved the uncommitted ${dir}/ from the main checkout into the worktree; it travels with the branch.`);
}

/**
 * The brief must never be committed. `.gitignore` covers it from §27 on, but a
 * worktree based on an older ref lacks that line, so also list it in the
 * repository's shared info/exclude.
 */
function ignoreBrief(path) {
  const exclude = resolve(path, git(path, 'rev-parse', '--git-path', 'info/exclude'));
  const current = existsSync(exclude) ? readFileSync(exclude, 'utf8') : '';
  if (/^\/?CLAUDE\.local\.md\s*$/m.test(current)) return;
  mkdirSync(dirname(exclude), { recursive: true });
  appendFileSync(exclude, `${current && !current.endsWith('\n') ? '\n' : ''}CLAUDE.local.md\n`);
}

function install(path) {
  console.log('Installing dependencies (npm ci)…');
  // One command string: npm is npm.cmd on Windows, so it needs a shell, and
  // Node deprecates passing an args array alongside shell: true.
  const r = spawnSync('npm ci --no-audit --no-fund', { cwd: path, stdio: 'inherit', shell: true });
  if (r.status !== 0) console.warn('spawn: npm ci failed; run it in the worktree before `npm run verify`.');
}

/** The worktree already serving intent `id`, other than the main checkout, or undefined. */
function worktreeFor(root, id) {
  return parseWorktreeList(git(root, 'worktree', 'list', '--porcelain')).find(
    (w) => w.branch && parseBranch(w.branch)?.id === id && pathKey(w.path) !== pathKey(root),
  );
}

function spawn() {
  const root = mainCheckout(process.cwd());
  const existing = worktreeFor(root, id);
  if (existing) fail(`§${id} already has a worktree at ${existing.path} (${existing.branch}). See npm run sessions.`);
  const found = readIntentMetadata(root, id) ?? readIntentMetadataFromBranch(root, id);
  if (!found) fail(`no intents/${id}-*/metadata.yml in ${root} or on any local branch for §${id}. Draft it with /intent first.`);
  const { dir, metadata } = found;
  const path = worktreePathFor(root, id, metadata.slug);
  if (existsSync(path)) fail(`${path} already exists. See npm run sessions.`);
  const branch = branchFor({ type: metadata.type, id, slug: metadata.slug });
  const port = portFor(id);

  if (branchExists(root, branch)) git(root, 'worktree', 'add', path, branch);
  else git(root, 'worktree', 'add', '-b', branch, path, option('--base', 'main'));
  carryIntentFolder(root, dir, path);
  ignoreBrief(path);
  writeFileSync(
    join(path, 'CLAUDE.local.md'),
    sessionBrief({ id, slug: metadata.slug, type: metadata.type, branch, intentDir: dir, port, coordinatorPath: root }),
  );
  if (!flag('--no-install')) install(path);
  appendEvent(path, { event: 'spawned', detail: `port ${port}` });

  console.log(`
§${id} ready
  worktree  ${path}
  branch    ${branch}
  port      ${port}   (npm run dev -- --port ${port} --strictPort --host 127.0.0.1)
  status    ${metadata.status}

Start its session:  cd "${path}" && claude
(or open that folder in the Claude Code desktop app)`);
}

function remove() {
  const root = mainCheckout(process.cwd());
  const wt = worktreeFor(root, id);
  if (!wt) fail(`no worktree for §${id}. See npm run sessions.`);
  const nm = join(wt.path, 'node_modules');
  if (existsSync(nm) && lstatSync(nm).isSymbolicLink()) {
    fail(`${nm} is a link. Removing the worktree would wipe its target (plan.md §4). Delete the link first: cmd //c rmdir "${nm}"`);
  }
  try {
    git(root, 'merge-base', '--is-ancestor', wt.branch, 'main');
  } catch {
    if (!flag('--unmerged')) fail(`${wt.branch} is not merged into main. Pass --unmerged to remove the worktree anyway (the branch is kept).`);
  }
  git(root, 'worktree', 'remove', wt.path);
  appendEvent(root, { event: 'removed', id, branch: wt.branch, worktree: wt.path });
  console.log(`Removed ${wt.path}. Branch ${wt.branch} is kept; delete it with: git branch -d ${wt.branch}`);
}

if (!id) fail('usage: npm run spawn -- <id> [--base <ref>] [--no-install] | <id> --remove [--unmerged]');
try {
  if (flag('--remove')) remove();
  else spawn();
} catch (e) {
  fail(e.stderr?.toString().trim() || e.message);
}
