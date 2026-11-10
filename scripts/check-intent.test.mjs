// End-to-end tests for `npm run check:intent`'s live-check enforcement,
// against a throwaway git repository in the OS temp dir — never this
// repository. The rules are unit-tested in intent-check-lib.test.mjs; these
// prove the CLI actually reads review.md (from the branch and from the
// working tree) and refuses a merge check that can't see what's uncommitted.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const CHECK = join(dirname(fileURLToPath(import.meta.url)), 'check-intent.mjs');
const BRANCH = 'feat/97-probe';
const DIR = join('intents', '97-probe');

// Drop inherited GIT_* variables so the sandbox's git never points at this
// repository (see spawn-intent.test.mjs).
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
const check = (...args) => spawnSync(process.execPath, [CHECK, ...args], { cwd: repo, env: GIT_ENV, encoding: 'utf8' });
const write = (name, text) => writeFileSync(join(repo, DIR, name), text);
const metadata = (liveChecked = '') =>
  [
    'id: 97',
    'slug: probe',
    'type: feature',
    'status: in-review',
    'intent_accepted: 2026-10-08',
    'spec_accepted: 2026-10-08',
    'plan_approved: 2026-10-08',
    `live_checked: ${liveChecked}`,
    '',
  ].join('\n');

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'h28-check-'));
  repo = join(sandbox, 'repo');
  mkdirSync(repo);
  git('init', '-q', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  writeFileSync(join(repo, 'README.md'), 'probe\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');

  git('checkout', '-q', '-b', BRANCH);
  mkdirSync(join(repo, DIR), { recursive: true });
  for (const f of ['intent.md', 'spec.md', 'plan.md']) write(f, `# §97 ${f}\n`);
  write('metadata.yml', metadata());
  write('review.md', 'verdict: attest\ntier: attested\nlive-check: owed\n\n## Live check\n- steps: …\n');
  git('add', '.');
  git('commit', '-q', '-m', '§97 reviewed, live check owed');
  git('checkout', '-q', 'main');
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('check:intent and live checks, end to end', { timeout: 60_000 }, () => {
  it('reads a committed review.md in branch mode, from another checkout', () => {
    const r = check(BRANCH);
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.stdout).toMatch(/A live check is owed and not recorded.*## Live check/);
  });

  it('reads review.md in working-tree mode', () => {
    git('checkout', '-q', BRANCH);
    const r = check();
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.stdout).toMatch(/A live check is owed/);
  });

  it("fails the branch-mode check while the date is recorded but not committed, in the branch's own checkout", () => {
    write('metadata.yml', metadata('2026-10-16'));
    const wt = check();
    expect(wt.status, wt.stdout).toBe(0); // the working tree has the date
    const br = check(BRANCH);
    expect(br.status, br.stdout).toBe(1);
    expect(br.stdout).toMatch(/changes not committed to feat\/97-probe/);
    expect(br.stdout).toMatch(/A live check is owed/); // what git holds still lacks the date
  });

  it("fails the branch-mode check while review.md is changed but not committed, in the branch's own checkout", () => {
    // The round-1 case: a fresh report on disk that the merge check can't see.
    const committed = metadata('2026-10-16');
    write('metadata.yml', committed);
    git('commit', '-q', '-am', '§97 live check done');
    write('review.md', 'verdict: rework\ntier: attested\nlive-check: owed\n');
    try {
      const r = check(BRANCH);
      expect(r.status, r.stdout).toBe(1);
      expect(r.stdout).toMatch(/changes not committed to feat\/97-probe/);
    } finally {
      git('checkout', '-q', '--', join(DIR, 'review.md'));
    }
  });

  it('passes once the date is committed, from either checkout', () => {
    // Committed by the previous test; review.md was restored there.
    expect(git('status', '--porcelain')).toBe('');
    expect(check(BRANCH).status).toBe(0);
    git('checkout', '-q', 'main');
    const r = check(BRANCH);
    expect(r.status, r.stdout).toBe(0);
  });

  it("ignores another checkout's uncommitted files at the intent's path", () => {
    // The coordinator, on main, may have a stray draft there; it says nothing
    // about what the branch holds.
    mkdirSync(join(repo, DIR), { recursive: true });
    write('review.md', 'verdict: rework\nlive-check: owed\n');
    try {
      const r = check(BRANCH);
      expect(r.status, r.stdout).toBe(0);
    } finally {
      rmSync(join(repo, DIR), { recursive: true, force: true });
    }
  });
});

// The size budget (§61, scripts/size-budget-lib.mjs) end to end: the CLI
// measures budgeted files from the branch's tree (git cat-file --batch) or the
// working tree, reads scripts/size-baseline.json on the branch and the merge
// base, reads plan.md, and joins the failures into its errors and routes. The
// rules themselves are unit-tested in size-budget-lib.test.mjs.
describe('check:intent and the size budget, end to end', { timeout: 120_000 }, () => {
  const BIG = 'scripts/big.mjs';
  const lines = (n) => '// line\n'.repeat(n);
  const plan = (budget = '') => `# §9 plan\n\n## Where this goes\n- everything in scripts/big.mjs\n${budget}\n## Phases\n- one\n`;
  const baseline = (n) => `${JSON.stringify({ [BIG]: n }, null, 2)}\n`;
  let box;
  let r; // the sandbox repository
  const sh = (...args) => execFileSync('git', args, { cwd: r, env: GIT_ENV, encoding: 'utf8' }).trim();
  const run = (...args) => spawnSync(process.execPath, [CHECK, ...args], { cwd: r, env: GIT_ENV, encoding: 'utf8' });
  const put = (rel, text) => {
    mkdirSync(dirname(join(r, rel)), { recursive: true });
    writeFileSync(join(r, rel), text);
  };

  /** main has big.mjs at 520 lines and a baseline saying so (or no baseline at all). */
  const newRepo = (withBaseline) => {
    box = mkdtempSync(join(tmpdir(), 'h61-budget-'));
    r = join(box, 'repo');
    mkdirSync(r);
    sh('init', '-q', '-b', 'main');
    sh('config', 'core.autocrlf', 'false');
    put('README.md', 'probe\n');
    put(BIG, lines(520));
    if (withBaseline) put('scripts/size-baseline.json', baseline(520));
    sh('add', '.');
    sh('commit', '-q', '-m', 'init');
  };

  /** A feature branch 96 that grows big.mjs to `size`, with the given baseline text and plan budget line. */
  const featureBranch = ({ size, ceiling, budget }) => {
    sh('checkout', '-q', '-b', 'feat/96-grow');
    put('intents/96-grow/intent.md', '# §96\n');
    put('intents/96-grow/spec.md', '# §96\n');
    put('intents/96-grow/plan.md', plan(budget));
    put(
      'intents/96-grow/metadata.yml',
      ['id: 96', 'slug: grow', 'type: feature', 'status: in-review', 'intent_accepted: 2026-10-08', 'spec_accepted: 2026-10-08', 'plan_approved: 2026-10-08', 'live_checked: ', ''].join('\n'),
    );
    put('intents/96-grow/review.md', 'verdict: attest\ntier: attested\nlive-check: not-needed\n');
    put(BIG, lines(size));
    if (ceiling !== undefined) put('scripts/size-baseline.json', baseline(ceiling));
    sh('add', '.');
    sh('commit', '-q', '-m', '§96 grow');
  };

  afterEach(() => {
    rmSync(box, { recursive: true, force: true });
  });

  it('fails a branch that grows a budgeted file past its ceiling, in branch and working-tree mode', () => {
    newRepo(true);
    featureBranch({ size: 540 });
    const byBranch = run('feat/96-grow');
    expect(byBranch.status, byBranch.stdout + byBranch.stderr).toBe(1);
    expect(byBranch.stdout).toMatch(/Size budget: scripts\/big\.mjs has 540 lines, over its ceiling of 520/);
    const byTree = run();
    expect(byTree.status, byTree.stdout + byTree.stderr).toBe(1);
    expect(byTree.stdout).toMatch(/Size budget: scripts\/big\.mjs has 540 lines, over its ceiling of 520/);
  });

  it('passes the same growth when the ceiling is raised with a budget: line under "Where this goes"', () => {
    newRepo(true);
    featureBranch({ size: 540, ceiling: 540, budget: '- budget: scripts/big.mjs +20: the check grew\n' });
    expect(run('feat/96-grow').status).toBe(0);
    expect(run().status).toBe(0);
  });

  it('fails a raised ceiling with no budget: line, and one whose line sits outside "Where this goes"', () => {
    newRepo(true);
    featureBranch({ size: 540, ceiling: 540 });
    const none = run('feat/96-grow');
    expect(none.status, none.stdout).toBe(1);
    expect(none.stdout).toMatch(/without a matching "budget: scripts\/big\.mjs \+20/);
    expect(run().status).toBe(1);
    put('intents/96-grow/plan.md', `${plan()}\n- budget: scripts/big.mjs +20: wrong section\n`);
    sh('commit', '-q', '-am', 'budget line in the wrong section');
    expect(run('feat/96-grow').status).toBe(1);
  });

  it('routes an over-budget adjustment, which has no plan to state a budget line', () => {
    newRepo(true);
    sh('checkout', '-q', '-b', 'adjust/95-grow');
    put('intents/95-grow/intent.md', '# §95\n');
    put('intents/95-grow/metadata.yml', ['id: 95', 'slug: grow', 'type: adjustment', 'status: in-review', 'intent_accepted: 2026-10-08', ''].join('\n'));
    put('intents/95-grow/review.md', 'verdict: attest\ntier: attested\nlive-check: not-needed\n');
    put(BIG, lines(540));
    put('scripts/size-baseline.json', baseline(540));
    sh('add', '.');
    sh('commit', '-q', '-m', '§95 grow');
    const byBranch = run('adjust/95-grow');
    expect(byBranch.status, byBranch.stdout + byBranch.stderr).toBe(2);
    expect(byBranch.stdout).toMatch(/Declared adjustment, which has no plan to state a budget: line/);
    expect(run().status).toBe(2);
  });

  it('skips the budget when neither the branch nor its merge base has a baseline', () => {
    newRepo(false);
    featureBranch({ size: 900 });
    const byBranch = run('feat/96-grow');
    expect(byBranch.status, byBranch.stdout + byBranch.stderr).toBe(0);
    expect(byBranch.stdout).not.toMatch(/Size budget/);
    expect(run().status).toBe(0);
  });

  it('checks a baseline the branch creates (the merge base has none), skipping only the growth rules', () => {
    newRepo(false);
    featureBranch({ size: 540, ceiling: 520 }); // creates the baseline, but big.mjs is already over it
    const over = run('feat/96-grow');
    expect(over.status, over.stdout).toBe(1);
    expect(over.stdout).toMatch(/has 540 lines, over its ceiling of 520/);
    expect(over.stdout).not.toMatch(/without a matching/); // nothing to grow from, so rules 3 and 4 stay quiet
    sh('checkout', '-q', 'main');
    sh('branch', '-D', 'feat/96-grow');
    featureBranch({ size: 520, ceiling: 520 });
    expect(run('feat/96-grow').status).toBe(0);
  });

  it('measures a budgeted file that is only untracked in working-tree mode', () => {
    newRepo(true);
    featureBranch({ size: 520, ceiling: 520 });
    put('scripts/fresh.mjs', lines(530)); // new, over the limit, in no baseline
    const r2 = run();
    expect(r2.status, r2.stdout).toBe(1);
    expect(r2.stdout).toMatch(/scripts\/fresh\.mjs has 530 lines, over 500, and is not in scripts\/size-baseline\.json/);
  });
});
