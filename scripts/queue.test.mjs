// End-to-end test for `npm run queue`, against a throwaway git repository in
// the OS temp dir — never this repository (same harness as spawn-intent.test.mjs).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const QUEUE = join(dirname(fileURLToPath(import.meta.url)), 'queue.mjs');

// No inherited GIT_* variables: they could point the sandbox's git at the real repository.
const GIT_ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/i.test(k))),
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@example.com',
};

let sandbox;
let repo;
const git = (...args) => execFileSync('git', args, { cwd: repo, env: GIT_ENV, encoding: 'utf8' }).trim();
const queue = (...args) => spawnSync(process.execPath, [QUEUE, ...args], { cwd: repo, env: GIT_ENV, encoding: 'utf8' });
const meta = (id, slug, status, extra = '') =>
  `id: ${id}\nslug: ${slug}\ntype: fix\nstatus: ${status}\ntitle: Title ${id}\n${extra}`;
const write = (path, text) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
};
const commit = (msg) => {
  git('add', '.');
  git('commit', '-q', '-m', msg);
};

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'h47-queue-'));
  repo = join(sandbox, 'repo');
  mkdirSync(repo);
  git('init', '-q', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  write('plan-history.md', 'old work §3\n');
  write('intents/1-first/metadata.yml', meta(1, 'first', 'accepted'));
  write('intents/2-second/metadata.yml', meta(2, 'second', 'accepted'));
  commit('init');
  // §2's implementer finished on its branch; main still says accepted.
  git('checkout', '-q', '-b', 'fix/2-second');
  write('intents/2-second/metadata.yml', meta(2, 'second', 'in-review'));
  commit('§2 in review');
  // A draft started on a branch that main has never seen.
  git('checkout', '-q', 'main');
  git('checkout', '-q', '-b', 'fix/60-elsewhere');
  write('intents/60-elsewhere/metadata.yml', meta(60, 'elsewhere', 'draft'));
  commit('§60 draft');
  git('checkout', '-q', 'main');
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('npm run queue', { timeout: 60_000 }, () => {
  it('reads an unmerged branch for status and main for the rest, and says which', () => {
    const r = queue();
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/In flight \(2\)/);
    expect(r.stdout).toMatch(/§1 {2}Title 1 {2}\[fix\] accepted {2}.* main/);
    expect(r.stdout).toMatch(/§2 {2}Title 2 {2}\[fix\] in-review {2}.* branch/);
  });

  it('reads main again once the branch is merged', () => {
    git('merge', '-q', '--no-ff', '-m', 'Merge §2', 'fix/2-second');
    const sha = git('rev-parse', '--short=7', 'HEAD');
    write('intents/2-second/metadata.yml', meta(2, 'second', 'done', `merged: ${sha}\n`));
    commit('§2 done');
    const out = queue().stdout;
    expect(out).toMatch(/Shipped \(1\)\n {2}§2 .*\[fix\] done .* main {2}[0-9a-f]{7}/);
    expect(out).toMatch(/In flight \(1\)/);
  });

  it('counts an intent folder that exists only on a branch in --next-id', () => {
    expect(queue('--next-id').stdout.trim()).toBe('61');
  });

  it('--json has the same entries', () => {
    const data = JSON.parse(queue('--json').stdout);
    expect(data.inFlight.map((e) => [e.id, e.source])).toEqual([[1, 'main']]);
    expect(data.shipped.map((e) => [e.id, e.status])).toEqual([[2, 'done']]);
  });
});
