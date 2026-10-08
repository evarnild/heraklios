// End-to-end tests for `npm run spawn` and the session-event hook, against a
// throwaway git repository in the OS temp dir — never this repository. These
// cover the code that moves files and decides whether a worktree may be
// deleted, so they run the real scripts rather than their pure helpers.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SPAWN = join(here, 'spawn-intent.mjs');
const EVENT = join(here, 'session-event.mjs');
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@example.com',
};

let sandbox;
let repo;
let worktree;

const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();
const run = (script, args, opts = {}) =>
  spawnSync(process.execPath, [script, ...args], { cwd: repo, env: GIT_ENV, encoding: 'utf8', ...opts });
const logOf = (root) => {
  const file = join(root, '.git', 'heraklios-sessions.jsonl');
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'h27-spawn-'));
  repo = join(sandbox, 'repo');
  worktree = join(sandbox, 'heraklios-wt', '98-probe-thing');
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  // A base without §27's .gitignore line, like an old --base ref.
  writeFileSync(join(repo, 'README.md'), 'probe\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'init');
  // An intent drafted in the main checkout but never committed.
  mkdirSync(join(repo, 'intents', '98-probe-thing'), { recursive: true });
  writeFileSync(join(repo, 'intents', '98-probe-thing', 'metadata.yml'), 'id: 98\nslug: probe-thing\ntype: fix\nstatus: draft\n');
  writeFileSync(join(repo, 'intents', '98-probe-thing', 'intent.md'), '# §98 probe\n');
});

afterAll(() => {
  try {
    git(repo, 'worktree', 'remove', '--force', worktree);
  } catch {
    // already removed by the tests
  }
  rmSync(sandbox, { recursive: true, force: true });
});

describe('npm run spawn', { timeout: 60_000 }, () => {
  it('moves an uncommitted intent into a new worktree, briefs it, and keeps the brief out of git', () => {
    const r = run(SPAWN, ['98', '--no-install']);
    expect(r.status, r.stderr).toBe(0);
    expect(git(worktree, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('fix/98-probe-thing');
    expect(readFileSync(join(worktree, 'intents', '98-probe-thing', 'intent.md'), 'utf8')).toBe('# §98 probe\n');
    expect(existsSync(join(repo, 'intents', '98-probe-thing'))).toBe(false);
    expect(readFileSync(join(worktree, 'CLAUDE.local.md'), 'utf8')).toContain('You are the session for §98');
    expect(git(worktree, 'status', '--porcelain')).not.toContain('CLAUDE.local.md');
    expect(logOf(repo)).toMatch(/"event":"spawned".*"detail":"port 5298"/);
  });

  it('refuses to spawn over an existing worktree with the right message', () => {
    const r = run(SPAWN, ['98', '--no-install']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/already has a worktree/);
    expect(r.stderr).not.toMatch(/Draft it/);
  });

  it('refuses to remove an unmerged worktree', () => {
    git(worktree, 'add', 'intents');
    git(worktree, 'commit', '-q', '-m', '§98 intent');
    const r = run(SPAWN, ['98', '--remove']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not merged into main/);
    expect(existsSync(worktree)).toBe(true);
  });

  it('refuses to remove a worktree whose node_modules is a link, and leaves the link target alone', () => {
    const target = join(sandbox, 'shared-node_modules');
    mkdirSync(target);
    writeFileSync(join(target, 'sentinel'), 'keep me');
    const nm = join(worktree, 'node_modules');
    symlinkSync(target, nm, process.platform === 'win32' ? 'junction' : 'dir');
    try {
      const r = run(SPAWN, ['98', '--remove', '--unmerged']);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/is a link/);
      expect(existsSync(worktree)).toBe(true);
    } finally {
      unlinkSync(nm);
    }
    expect(readFileSync(join(target, 'sentinel'), 'utf8')).toBe('keep me');
  });

  it('refuses to remove a worktree with uncommitted files', () => {
    writeFileSync(join(worktree, 'scratch.txt'), 'wip');
    try {
      const r = run(SPAWN, ['98', '--remove', '--unmerged']);
      expect(r.status).toBe(1);
      expect(existsSync(join(worktree, 'scratch.txt'))).toBe(true);
    } finally {
      rmSync(join(worktree, 'scratch.txt'));
    }
  });

  it('removes with --unmerged, then re-spawns from the intent on its branch', () => {
    expect(run(SPAWN, ['98', '--remove', '--unmerged']).status).toBe(0);
    expect(existsSync(worktree)).toBe(false);
    expect(git(repo, 'branch', '--list', 'fix/98-probe-thing')).toContain('fix/98-probe-thing'); // branch kept

    const r = run(SPAWN, ['98', '--no-install']);
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(join(worktree, 'intents', '98-probe-thing', 'metadata.yml'))).toBe(true);
    expect(existsSync(join(repo, 'intents', '98-probe-thing'))).toBe(false);
  });

  it('removes without --unmerged once the branch is merged', () => {
    git(repo, 'merge', '-q', '--no-ff', '-m', 'merge §98', 'fix/98-probe-thing');
    expect(run(SPAWN, ['98', '--remove']).status).toBe(0);
    expect(existsSync(worktree)).toBe(false);
    expect(logOf(repo)).toMatch(/"event":"removed"/);
  });
});

describe('session-event hook', { timeout: 30_000 }, () => {
  it('logs under CLAUDE_PROJECT_DIR, not the cwd, and never logs prompt text', () => {
    const other = join(sandbox, 'other');
    mkdirSync(other);
    git(other, 'init', '-q', '-b', 'main');
    const payload = { hook_event_name: 'UserPromptSubmit', session_id: 's1', cwd: other, prompt: 'token sk-SECRET-9' };
    const r = run(EVENT, [], { cwd: other, env: { ...GIT_ENV, CLAUDE_PROJECT_DIR: repo }, input: JSON.stringify(payload) });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(logOf(repo)).toMatch(/"event":"UserPromptSubmit".*"promptChars":17/);
    expect(logOf(repo)).not.toContain('SECRET');
    expect(logOf(other)).toBe('');
  });

  it('stays silent and exits 0 on garbage', () => {
    for (const input of ['', 'not json', '[]', 'null']) {
      const r = run(EVENT, [], { input, env: { ...GIT_ENV, CLAUDE_PROJECT_DIR: repo } });
      expect(r.status).toBe(0);
      expect(r.stdout + r.stderr).toBe('');
    }
  });
});
