// End-to-end tests for `npm run ship`, against throwaway git repositories (a
// main checkout, a bare `origin` and `heraklios-wt/` beside it) in the OS temp
// dir. Never the real repository: the script merges and pushes.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SHIP = join(here, 'ship.mjs');

// No inherited GIT_* variable may point the sandbox's git at the real repository.
const GIT_ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/i.test(k))),
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@example.com',
};
const VERIFY_OK = 'node -e "process.exit(0)"';
const VERIFY_RED = 'node -e "console.error(\'boom\');process.exit(3)"';
const TRAILER = 'Co-Authored-By: T <t@example.com>';

let sandbox;
let repo;
let origin;
const wt = (name) => join(sandbox, 'heraklios-wt', name);
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();
const ship = (args, verify = VERIFY_OK) =>
  spawnSync(process.execPath, [SHIP, ...args], {
    cwd: repo,
    env: { ...GIT_ENV, HERAKLIOS_SHIP_VERIFY: verify },
    encoding: 'utf8',
  });
const out = (r) => `${r.stdout}\n${r.stderr}`;
const read = (...p) => readFileSync(join(repo, ...p), 'utf8');
const branchExists = (b) => {
  try {
    git(repo, 'show-ref', '--verify', '--quiet', `refs/heads/${b}`);
    return true;
  } catch {
    return false;
  }
};

const CRLF = (lines) => lines.join('\r\n') + '\r\n';
const planText = (ids) =>
  CRLF([
    '# Plan',
    '',
    '### Shipped',
    '',
    '| Item | Merge |',
    '| --- | --- |',
    '| [§1](intents/1-old/) old | `0000001` |',
    '',
    '### In flight',
    '',
    '| Item | Type · status |',
    '| --- | --- |',
    '',
    '### Queued',
    '',
    '| Item | Type · status |',
    '| --- | --- |',
    ...ids.map((id) => `| [§${id}](intents/${id}-t${id}/) thing ${id} | feature · in review |`),
    '',
  ]);

const metadataText = (id, eol) =>
  [
    '# generated-by: test',
    `id: ${id}`,
    `slug: t${id}`,
    'type: feature',
    'status: in-review',
    `title: Thing ${id}`,
    'intent_accepted: 2026-10-01',
    'spec_accepted: 2026-10-01',
    'plan_approved: 2026-10-01',
    'live_checked:',
    'merged:',
    '',
  ].join(eol);

/**
 * An intent branch with a worktree: the work commit, then review.md naming it
 * as reviewed-commit. `extra` tunes the verdict, the live-check line, an
 * extra file in the work commit and the review text.
 */
function makeIntent(id, extra = {}) {
  const { verdict = 'escalate', liveCheck = 'not-needed', file = `docs/t${id}.md`, body = '', eol = '\n' } = extra;
  const branch = `feat/${id}-t${id}`;
  const path = wt(`${id}-t${id}`);
  git(repo, 'worktree', 'add', '-q', '-b', branch, path, 'main');
  const dir = join(path, 'intents', `${id}-t${id}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'metadata.yml'), metadataText(id, eol));
  for (const f of ['intent.md', 'spec.md', 'plan.md']) writeFileSync(join(dir, f), `# §${id} ${f}\n`);
  mkdirSync(dirname(join(path, file)), { recursive: true });
  writeFileSync(join(path, file), `work ${id}\n`);
  git(path, 'add', '.');
  git(path, 'commit', '-q', '-m', `§${id}: work`);
  const reviewed = git(path, 'rev-parse', '--short', 'HEAD');
  writeFileSync(
    join(dir, 'review.md'),
    `# §${id} review\n\nverdict: ${verdict}\ntier: reviewed\nreviewed-commit: ${reviewed}\nround: 2\nsampled: no\nlive-check: ${liveCheck}\n\n## Type check\nPASS\n\n## Findings\n- none\n${body}`,
  );
  git(path, 'add', '.');
  git(path, 'commit', '-q', '-m', `§${id}: review`);
  return { branch, path, dir: `intents/${id}-t${id}` };
}

const IDS = [11, 12, 13, 14, 15, 16, 17, 18, 19];

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'h46-ship-'));
  repo = join(sandbox, 'repo');
  origin = join(sandbox, 'origin.git');
  mkdirSync(repo);
  git(sandbox, 'init', '-q', '--bare', '-b', 'main', origin);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'core.autocrlf', 'false'); // byte-exact whatever the machine's global setting
  writeFileSync(join(repo, 'README.md'), 'probe\n');
  writeFileSync(join(repo, 'plan.md'), planText(IDS));
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-q', 'origin', 'main');
});

afterAll(() => {
  try {
    const paths = git(repo, 'worktree', 'list', '--porcelain')
      .split(/\r?\n/)
      .filter((l) => l.startsWith('worktree '))
      .map((l) => l.slice('worktree '.length))
      .slice(1);
    for (const p of paths) git(repo, 'worktree', 'remove', '--force', p);
  } catch {
    // the sandbox goes anyway
  }
  rmSync(sandbox, { recursive: true, force: true });
});

describe('npm run ship', { timeout: 90_000 }, () => {
  it('refuses to run without an id', () => {
    const r = ship([]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/usage/);
  });

  it('records the live check, merges, verifies, books, pushes and removes worktree and branch', () => {
    const w = makeIntent(11, { liveCheck: 'owed', eol: '\r\n' });
    const r = ship(['11', '--live-checked', 'it looks "right"', '--trailer', TRAILER]);
    expect(r.status, out(r)).toBe(0);

    const merge = git(repo, 'log', '-1', '--merges', '--format=%h', 'main');
    expect(git(repo, 'log', '-1', '--merges', '--format=%B', 'main')).toBe(`Merge §11: Thing 11\n\n${TRAILER}`);
    expect(git(repo, 'rev-parse', 'origin/main')).toBe(git(repo, 'rev-parse', 'main'));
    expect(git(origin, 'rev-parse', 'main')).toBe(git(repo, 'rev-parse', 'main'));
    expect(existsSync(w.path)).toBe(false);
    expect(branchExists(w.branch)).toBe(false);

    const meta = read('intents', '11-t11', 'metadata.yml');
    expect(meta).toContain('status: done\r\n');
    expect(meta).toContain(`merged: ${merge}    # `);
    expect(meta).toContain(`by-agent    # owner: "it looks 'right'"\r\n`);
    expect(meta.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/); // every line ending stayed CRLF
    const plan = read('plan.md');
    expect(plan).toContain(`feature, Reviewed, 2 review rounds; see [review.md](intents/11-t11/review.md)) | \`${merge}\` |\r\n`);
    expect(plan.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(plan).not.toContain('thing 11 | feature');
    expect(git(repo, 'status', '--porcelain')).toBe('');
    expect(git(repo, 'log', '-1', '--format=%B')).toContain(TRAILER);
    const events = readFileSync(join(repo, '.git', 'heraklios-sessions.jsonl'), 'utf8').split(/\r?\n/);
    expect(events.some((l) => l.includes('"event":"shipped"') && l.includes('"id":"11"'))).toBe(true);
    // the order of the report is the order of the steps
    const o = r.stdout;
    for (const [a, b] of [['live-check', 'preconditions'], ['preconditions', 'merge'], ['merge', 'verify'], ['verify', 'bookkeeping'], ['bookkeeping', 'push'], ['push', 'remove']]) {
      expect(o.indexOf(a)).toBeLessThan(o.lastIndexOf(b));
    }
  });

  it('stops at the preconditions on a rework verdict and changes nothing, even with --live-checked', () => {
    const w = makeIntent(12, { verdict: 'rework', liveCheck: 'owed' });
    const before = { main: git(repo, 'rev-parse', 'main'), branch: git(repo, 'rev-parse', w.branch) };
    const r = ship(['12', '--live-checked', 'ok']);
    expect(r.status, out(r)).toBe(1);
    expect(r.stdout).toMatch(/STOPPED\s+preconditions\s+verdict/);
    expect(git(repo, 'rev-parse', 'main')).toBe(before.main);
    expect(git(repo, 'rev-parse', w.branch)).toBe(before.branch);
    expect(git(repo, 'rev-parse', 'origin/main')).toBe(before.main);
    expect(existsSync(w.path)).toBe(true);
    expect(git(repo, 'status', '--porcelain')).toBe('');
  });

  it('stops at the start when plan.md has uncommitted changes, and never commits them', () => {
    const w = makeIntent(13);
    const original = read('plan.md');
    writeFileSync(join(repo, 'plan.md'), `${original}\r\nsomeone else's edit\r\n`);
    try {
      const before = git(repo, 'rev-parse', 'main');
      const r = ship(['13']);
      expect(r.status, out(r)).toBe(1);
      expect(r.stdout).toMatch(/STOPPED\s+start\s+plan\.md/);
      expect(git(repo, 'rev-parse', 'main')).toBe(before);
      expect(branchExists(w.branch)).toBe(true);
      expect(git(repo, 'status', '--porcelain')).toBe('M plan.md');
    } finally {
      writeFileSync(join(repo, 'plan.md'), original);
    }
  });

  it('stops when a live check is owed and the owner gave no word', () => {
    const w = makeIntent(17, { liveCheck: 'owed' });
    const before = git(repo, 'rev-parse', w.branch);
    const r = ship(['17']);
    expect(r.status, out(r)).toBe(1);
    expect(r.stdout).toMatch(/STOPPED\s+preconditions\s+check-intent/);
    expect(r.stdout).toMatch(/live check is owed/);
    expect(git(repo, 'rev-parse', w.branch)).toBe(before);
  });

  it('resumes after a red verify: merged once, no bookkeeping or push until it is green', () => {
    const w = makeIntent(14);
    const origin0 = git(origin, 'rev-parse', 'main');
    const red = ship(['14'], VERIFY_RED);
    expect(red.status, out(red)).toBe(1);
    expect(red.stdout).toMatch(/STOPPED\s+verify/);
    expect(red.stdout).toMatch(/boom/);
    expect(git(repo, 'log', '-1', '--format=%s', 'main')).toBe('Merge §14: Thing 14');
    expect(git(origin, 'rev-parse', 'main')).toBe(origin0);
    expect(read('intents', '14-t14', 'metadata.yml')).toContain('status: in-review');
    expect(existsSync(w.path)).toBe(true);

    const green = ship(['14']);
    expect(green.status, out(green)).toBe(0);
    expect(green.stdout).toMatch(/skipped\s+merge/);
    expect(git(repo, 'log', '--merges', '--format=%s', 'main').split('\n').filter((s) => s === 'Merge §14: Thing 14')).toHaveLength(1);
    expect(git(origin, 'rev-parse', 'main')).toBe(git(repo, 'rev-parse', 'main'));
    expect(read('intents', '14-t14', 'metadata.yml')).toContain('status: done');
    expect(existsSync(w.path)).toBe(false);
    expect(branchExists(w.branch)).toBe(false);

    // and a run after everything is done changes nothing
    const head = git(repo, 'rev-parse', 'main');
    const again = ship(['14']);
    expect(again.status, out(again)).toBe(0);
    expect(git(repo, 'rev-parse', 'main')).toBe(head);
  });

  it('--dry-run prints the plan and changes nothing', () => {
    const w = makeIntent(15, { liveCheck: 'owed' });
    const before = { main: git(repo, 'rev-parse', 'main'), branch: git(repo, 'rev-parse', w.branch) };
    const r = ship(['15', '--dry-run', '--live-checked', 'ok']);
    expect(r.status, out(r)).toBe(0);
    expect(r.stdout).toMatch(/dry run/);
    expect(r.stdout).toMatch(/would\s+live-check/);
    expect(r.stdout).toMatch(/would\s+push/);
    expect(r.stdout).toMatch(/ok\s+preconditions/);
    expect(git(repo, 'rev-parse', 'main')).toBe(before.main);
    expect(git(repo, 'rev-parse', w.branch)).toBe(before.branch);
    expect(git(repo, 'status', '--porcelain')).toBe('');
    expect(git(w.path, 'status', '--porcelain')).toBe('');
    expect(existsSync(w.path)).toBe(true);
  });

  it('reports a worktree it cannot remove, and --cleanup finishes once it can', () => {
    const w = makeIntent(16);
    writeFileSync(join(w.path, 'open-in-an-editor.txt'), 'untracked: git worktree remove refuses this\n');
    const r = ship(['16']);
    expect(r.status, out(r)).toBe(0);
    expect(r.stdout).toMatch(/LEFT\s+remove/);
    expect(r.stdout).toContain(`npm run ship -- 16 --cleanup`);
    expect(git(origin, 'rev-parse', 'main')).toBe(git(repo, 'rev-parse', 'main')); // everything before it was done
    expect(branchExists(w.branch)).toBe(true);
    expect(existsSync(w.path)).toBe(true);

    rmSync(join(w.path, 'open-in-an-editor.txt'));
    const c = ship(['16', '--cleanup']);
    expect(c.status, out(c)).toBe(0);
    expect(existsSync(w.path)).toBe(false);
    expect(branchExists(w.branch)).toBe(false);
  });

  it('stops on a ROUTE that review.md does not explain, and ships one it does', () => {
    // rule code without a test routes the change to a fuller path
    const bad = makeIntent(18, { file: 'src/engine/x18.ts' });
    const before = git(repo, 'rev-parse', 'main');
    const r = ship(['18']);
    expect(r.status, out(r)).toBe(1);
    expect(r.stdout).toMatch(/STOPPED\s+preconditions\s+check-intent/);
    expect(git(repo, 'rev-parse', 'main')).toBe(before);
    expect(branchExists(bad.branch)).toBe(true);

    const ok = makeIntent(19, { file: 'src/engine/x19.ts', body: '\n## Not checked\n- The ROUTE is expected: a one-line constant, no rule changes.\n' });
    const r2 = ship(['19']);
    expect(r2.status, out(r2)).toBe(0);
    expect(r2.stdout).toMatch(/hold \(check:intent ROUTE\)/);
    expect(branchExists(ok.branch)).toBe(false);
  });
});
