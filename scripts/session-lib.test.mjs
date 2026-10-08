import { describe, expect, it } from 'vitest';
import {
  age,
  branchFor,
  clip,
  eventRecordFrom,
  formatEvent,
  formatStatusTable,
  gateSummary,
  latestEventByWorktree,
  notificationState,
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
    expect(clip('  padded  ')).toBe('padded');
    expect(clip('x'.repeat(5), 5)).toBe('xxxxx'); // exactly at the limit: not clipped
  });

  it('drops events that name no worktree, so one bad line cannot break the table', () => {
    const text = [
      JSON.stringify({ event: 'Stop' }),
      JSON.stringify({ worktree: 'C:/w/a' }),
      JSON.stringify({ event: 'Stop', worktree: 'C:/w/a' }),
    ].join('\n');
    const events = parseEvents(text);
    expect(events).toHaveLength(1);
    expect(() => latestEventByWorktree(events)).not.toThrow();
  });

  it('tells a permission prompt from the idle reminder', () => {
    expect(notificationState({ kind: 'permission_prompt', detail: 'Claude needs your permission to use Bash' })).toBe('needs you');
    expect(notificationState({ kind: 'elicitation_dialog' })).toBe('needs you');
    expect(notificationState({ kind: 'idle_prompt', detail: 'Claude is waiting for your input' })).toBe('idle');
    expect(notificationState({ kind: 'auth_success' })).toBe('idle');
    // Older Claude Code sends no notification_type: fall back to the text.
    expect(notificationState({ detail: 'Claude is waiting for your input' })).toBe('idle');
    expect(notificationState({ detail: 'Claude needs your permission to use Bash' })).toBe('needs you');
    expect(notificationState({ kind: 'something_new' })).toBe('needs you');
    expect(sessionState({ event: 'Notification', kind: 'idle_prompt', detail: 'x' }).state).toBe('idle');
  });
});

describe('eventRecordFrom', () => {
  const base = { session_id: 's1', cwd: 'C:/elsewhere' };

  it('logs a prompt by its length only, never its text', () => {
    const r = eventRecordFrom({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'my key is sk-SECRET-123' });
    expect(r.fields).toEqual({ event: 'UserPromptSubmit', session: 's1', promptChars: 23, detail: '23 chars' });
    expect(JSON.stringify(r)).not.toContain('SECRET');
    expect(eventRecordFrom({ ...base, hook_event_name: 'UserPromptSubmit' }).fields.promptChars).toBe(0);
  });

  it('keeps the notification type and message', () => {
    const r = eventRecordFrom({ ...base, hook_event_name: 'Notification', notification_type: 'idle_prompt', message: 'Claude is\nwaiting' });
    expect(r.fields).toMatchObject({ event: 'Notification', kind: 'idle_prompt', detail: 'Claude is waiting' });
    expect(eventRecordFrom({ ...base, hook_event_name: 'Notification', message: 'm' }).fields).not.toHaveProperty('kind');
  });

  it('records start source and end reason, nothing for other events', () => {
    expect(eventRecordFrom({ ...base, hook_event_name: 'SessionStart', source: 'startup' }).fields.detail).toBe('startup');
    expect(eventRecordFrom({ ...base, hook_event_name: 'SessionEnd', reason: 'logout' }).fields.detail).toBe('logout');
    expect(eventRecordFrom({ ...base, hook_event_name: 'Stop', prompt: 'leak?' }).fields.detail).toBe('');
  });

  it('files the event under the project directory, not the current one', () => {
    const input = { ...base, hook_event_name: 'Stop' };
    expect(eventRecordFrom(input, { CLAUDE_PROJECT_DIR: 'C:/proj' }, 'C:/fallback').dir).toBe('C:/proj');
    expect(eventRecordFrom(input, {}, 'C:/fallback').dir).toBe('C:/elsewhere');
    expect(eventRecordFrom({ hook_event_name: 'Stop' }, {}, 'C:/fallback').dir).toBe('C:/fallback');
  });

  it('ignores anything that is not a hook payload', () => {
    for (const bad of [null, [], 'x', 42, {}, { hook_event_name: { nested: true } }]) {
      expect(eventRecordFrom(bad)).toBeNull();
    }
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

  it('puts the unit boundaries exactly at 60 s, 1 h and 1 d, and never goes negative', () => {
    const at = (s) => new Date(now - s * 1000).toISOString();
    expect(age(at(59), now)).toBe('59s');
    expect(age(at(60), now)).toBe('1m');
    expect(age(at(3599), now)).toBe('59m');
    expect(age(at(3600), now)).toBe('1h');
    expect(age(at(86399), now)).toBe('23h');
    expect(age(at(86400), now)).toBe('1d');
    expect(age(at(-120), now)).toBe('0s'); // clock skew: an event "from the future"
  });

  it('summarises the gates each type needs', () => {
    expect(gateSummary({ type: 'fix', intent_accepted: '2026-10-07', plan_approved: [] })).toBe('I·-');
    const d = '2026-10-07';
    expect(gateSummary({ type: 'feature', intent_accepted: d, spec_accepted: d, plan_approved: d })).toBe('I·S·P');
    expect(gateSummary({ type: 'feature', intent_accepted: '~', spec_accepted: 'null', plan_approved: 'TBD' })).toBe('-·-·-');
    expect(gateSummary({ type: 'experiment', intent_accepted: d })).toBe('I');
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

  it('ranks unknown states after every known one and breaks ties by id', () => {
    const rows = [
      row({ id: '31', session: { state: 'SomethingNew' } }),
      row({ id: '30', session: { state: 'closed' } }),
      row({ id: '29', session: { state: 'idle' } }),
      row({ id: '28', session: { state: 'idle' } }),
    ];
    expect(sortRows(rows).map((r) => r.id)).toEqual(['28', '29', '30', '31']);
  });

  it('labels a detached worktree and lists only "needs you" rows under Waiting on you', () => {
    const text = formatStatusTable(
      [
        row({ id: null, branch: null, session: { state: 'idle', since: null, detail: 'Claude is waiting for your input' } }),
        row({ id: '28', session: { state: 'needs you', since: null, detail: 'permission for Bash' } }),
      ],
      now,
    );
    expect(text).toMatch(/^—\s+\(detached\)/m);
    expect(text).toContain('Waiting on you:\n  §28: permission for Bash');
    expect(text).not.toContain('waiting for your input');
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
    expect(brief).toContain('never switch branch');
    expect(brief).toContain('main checkout at `C:/Users/eric/src/heraklios`');
    expect(brief).toContain('set `status: in-review` in');
    expect(brief).toContain('`intents/28-naval-retreat/` (type: feature)');
  });
});
