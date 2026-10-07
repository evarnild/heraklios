import { describe, expect, it } from 'vitest';
import {
  age,
  branchFor,
  clip,
  formatEvent,
  formatStatusTable,
  gateSummary,
  latestEventByWorktree,
  parseEvents,
  parseWorktreeList,
  pathKey,
  portFor,
  sessionBrief,
  sessionState,
  sortRows,
  worktreePathFor,
} from './session-lib.mjs';

describe('naming scheme', () => {
  it('gives each intent a stable port clear of 5173 and 5199', () => {
    expect(portFor(27)).toBe(5227);
    expect(portFor('9')).toBe(5209);
    expect(portFor(73)).toBe(5273);
    expect(portFor(199)).toBe(5299);
  });

  it('derives the branch from type, id and slug', () => {
    expect(branchFor({ type: 'feature', id: '28', slug: 'naval-retreat' })).toBe('feat/28-naval-retreat');
    expect(branchFor({ type: 'adjustment', id: 29, slug: 'readme' })).toBe('adjust/29-readme');
    expect(() => branchFor({ type: 'chore', id: 1, slug: 'x' })).toThrow(/no branch prefix/);
  });

  it('puts worktrees next to the repo, not inside it', () => {
    expect(worktreePathFor('C:\\Users\\eric\\src\\heraklios', 27, 'parallel-sessions')).toBe(
      'C:/Users/eric/src/heraklios-wt/27-parallel-sessions',
    );
    expect(worktreePathFor('/home/e/heraklios/', 3, 'x')).toBe('/home/e/heraklios-wt/3-x');
  });

  it('matches paths across slash style, trailing slash and drive-letter case', () => {
    expect(pathKey('C:\\Users\\eric\\src\\heraklios-wt\\27-x\\')).toBe(pathKey('c:/Users/eric/src/heraklios-wt/27-x'));
  });
});

describe('parseWorktreeList', () => {
  it('reads branches, detached heads and skips bare entries', () => {
    const text = [
      'worktree C:/r/heraklios',
      'HEAD aaa',
      'branch refs/heads/main',
      '',
      'worktree C:/r/heraklios-wt/27-x',
      'HEAD bbb',
      'branch refs/heads/refactor/27-x',
      '',
      'worktree C:/r/review',
      'HEAD ccc',
      'detached',
      'prunable gitdir file points to non-existent location',
      '',
      'worktree C:/r/bare.git',
      'bare',
      '',
    ].join('\r\n');
    expect(parseWorktreeList(text)).toEqual([
      { path: 'C:/r/heraklios', head: 'aaa', branch: 'main', bare: false },
      { path: 'C:/r/heraklios-wt/27-x', head: 'bbb', branch: 'refactor/27-x', bare: false },
      { path: 'C:/r/review', head: 'ccc', branch: null, bare: false },
    ]);
  });
});

describe('events', () => {
  const line = (o) => JSON.stringify(o);

  it('skips half-written and foreign lines without losing the rest', () => {
    const text = [
      line({ ts: '2026-10-07T10:00:00Z', event: 'SessionStart', worktree: 'C:/w/a' }),
      '{"ts":"2026-10-07T10:01:00Z","event":"Sto',
      line({ hello: 'world' }),
      '',
      line({ ts: '2026-10-07T10:02:00Z', event: 'Stop', worktree: 'C:/w/a' }),
    ].join('\n');
    expect(parseEvents(text).map((e) => e.event)).toEqual(['SessionStart', 'Stop']);
  });

  it('keeps the latest event per worktree whatever path style wrote it', () => {
    const latest = latestEventByWorktree([
      { event: 'UserPromptSubmit', worktree: 'C:\\w\\a' },
      { event: 'Notification', worktree: 'c:/w/a', detail: 'needs permission' },
      { event: 'Stop', worktree: 'C:/w/b' },
    ]);
    expect(latest.get(pathKey('C:/w/a')).event).toBe('Notification');
    expect(latest.size).toBe(2);
  });

  it('names the session state each event implies', () => {
    expect(sessionState(undefined).state).toBe('no events');
    expect(sessionState({ event: 'spawned' }).state).toBe('not started');
    expect(sessionState({ event: 'UserPromptSubmit' }).state).toBe('working');
    expect(sessionState({ event: 'Stop' }).state).toBe('idle');
    expect(sessionState({ event: 'Notification', detail: 'x' })).toMatchObject({ state: 'needs you', detail: 'x' });
    expect(sessionState({ event: 'SessionEnd' }).state).toBe('closed');
    expect(sessionState({ event: 'SomethingNew' }).state).toBe('SomethingNew');
  });

  it('formats one event per line', () => {
    expect(formatEvent({ ts: 'T', id: '27', event: 'Stop', worktree: 'w' })).toBe('T  §27    Stop');
    expect(formatEvent({ ts: 'T', branch: 'main', event: 'SessionStart', worktree: 'w', detail: 'startup' })).toBe(
      'T  main   SessionStart      startup',
    );
  });

  it('clips details to one short line', () => {
    expect(clip('a\n  b')).toBe('a b');
    expect(clip('x'.repeat(10), 5)).toBe('xxxx…');
    expect(clip(undefined)).toBe('');
  });
});

describe('status table', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  const row = (over) => ({
    id: '27',
    branch: 'refactor/27-x',
    status: 'in-progress',
    gates: 'I·P',
    ahead: 2,
    behind: 0,
    dirty: 0,
    port: 5227,
    session: { state: 'working', since: '2026-10-07T11:56:00Z', detail: '' },
    ...over,
  });

  it('formats ages coarsely', () => {
    expect(age('2026-10-07T11:59:30Z', now)).toBe('30s');
    expect(age('2026-10-07T11:56:00Z', now)).toBe('4m');
    expect(age('2026-10-07T09:00:00Z', now)).toBe('3h');
    expect(age('2026-10-04T12:00:00Z', now)).toBe('3d');
    expect(age(null, now)).toBe('');
  });

  it('summarises the gates each type needs', () => {
    expect(gateSummary({ type: 'fix', intent_accepted: '2026-10-07', plan_approved: [] })).toBe('I·-');
    expect(gateSummary({ type: 'feature', intent_accepted: 'd', spec_accepted: 'd', plan_approved: 'd' })).toBe('I·S·P');
    expect(gateSummary({ type: 'feature', intent_accepted: '~' })).toBe('-·-·-');
    expect(gateSummary({ type: 'experiment', intent_accepted: 'd' })).toBe('I');
    expect(gateSummary({ type: 'chore' })).toBe('');
    expect(gateSummary(null)).toBe('');
  });

  it('puts sessions that need the owner first', () => {
    const rows = [
      row({ id: '28', session: { state: 'working' } }),
      row({ id: '29', session: { state: 'needs you' } }),
      row({ id: null, branch: 'main', session: { state: 'no events' } }),
      row({ id: '27', session: { state: 'idle' } }),
    ];
    expect(sortRows(rows).map((r) => r.id ?? r.branch)).toEqual(['29', '27', '28', 'main']);
  });

  it('renders aligned columns and lists what is waiting on the owner', () => {
    const text = formatStatusTable(
      [
        row({}),
        row({ id: '28', branch: 'feat/28-y', dirty: 3, session: { state: 'needs you', since: '2026-10-07T11:58:00Z', detail: 'Claude needs your permission to use Bash' } }),
        row({ id: null, branch: 'main', status: null, gates: null, ahead: null, port: null, session: { state: 'no events', since: null } }),
      ],
      now,
    );
    const lines = text.split('\n');
    expect(lines[0]).toMatch(/^§\s+branch\s+status\s+gates\s+±main\s+dirty\s+session\s+port$/);
    expect(lines[2]).toMatch(/^§28\s+feat\/28-y\s+in-progress\s+I·P\s+\+2\/-0\s+3\s+needs you \(2m\)\s+5227$/);
    expect(lines[3]).toMatch(/^§27\s+refactor\/27-x .* working \(4m\)\s+5227$/);
    expect(lines[4]).toMatch(/^—\s+main\s+no events$/);
    expect(text).toContain('Waiting on you:\n  §28: Claude needs your permission to use Bash');
  });
});

describe('sessionBrief', () => {
  it('tells the session its intent, branch, port and limits', () => {
    const brief = sessionBrief({
      id: '28',
      slug: 'naval-retreat',
      type: 'feature',
      branch: 'feat/28-naval-retreat',
      intentDir: 'intents/28-naval-retreat',
      port: 5228,
      coordinatorPath: 'C:/Users/eric/src/heraklios',
    });
    expect(brief).toContain('# You are the session for §28 — naval-retreat');
    expect(brief).toContain('`feat/28-naval-retreat`');
    expect(brief).toContain('--port 5228 --strictPort --host 127.0.0.1');
    expect(brief).toContain('Do not edit `plan.md`');
    expect(brief).toContain('Do not merge into `main`');
  });
});
