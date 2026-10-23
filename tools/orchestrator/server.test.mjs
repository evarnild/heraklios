import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHandler } from './server.mjs';

const ROOT = 'C:/repo';
const WT = 'C:/wt/52-orch';
const PORT = 5299;
const HOST = `127.0.0.1:${PORT}`;
const ORIGIN = `http://${HOST}`;
const script = (name, ...args) => [process.execPath, join(ROOT, 'scripts', name), ...args];

const norm = (p) => p.replace(/\\/g, '/');

/** A fake runner: records every call as `[file, ...args]` plus cwd, answers by a replaceable function. */
function fakeRunner(answer = () => ({ code: 0, stdout: '', stderr: '' })) {
  const calls = [];
  const runner = {
    calls,
    answer,
    async run(file, args, opts) {
      calls.push({ cmd: [file, ...args], cwd: opts.cwd });
      return runner.answer(file, args, opts);
    },
  };
  return runner;
}

function fakeFs(files = {}) {
  const map = new Map(Object.entries(files).map(([k, v]) => [norm(k), v]));
  const writes = [];
  return {
    map,
    writes,
    async readFile(p) {
      return map.get(norm(p)) ?? null;
    },
    async exists(p) {
      return map.has(norm(p));
    },
    async writeFile(p, text) {
      writes.push([norm(p), text]);
      map.set(norm(p), text);
    },
  };
}

const metaText = (over = {}) =>
  Object.entries({
    id: '52',
    slug: 'orch',
    type: 'feature',
    status: 'accepted',
    intent_accepted: '2026-10-23 by-agent',
    spec_accepted: '',
    plan_approved: '',
    live_checked: '',
    ...over,
  })
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n') + '\n';

const QUEUE = {
  inFlight: [{ id: 52, slug: 'orch', title: 'Orch', type: 'feature', status: 'accepted', gates: 'I--', auto: '', source: 'branch', merged: null }],
  queued: [{ id: 29, slug: 'grid', title: 'Grid', type: 'feature', status: 'draft', gates: '---', auto: '', source: 'main', merged: null }],
  shipped: [{ id: 51, slug: 'army', title: 'Army', type: 'feature', status: 'done', gates: 'ISP', auto: '', source: 'main', merged: 'ba52638' }],
};
const SESSIONS = [
  { id: '52', branch: 'feat/52-orch', path: WT, status: 'accepted', session: { state: 'working', since: null, ageSeconds: null, detail: '' } },
];

/** Answers queue/sessions --json like the scripts do; everything else succeeds with no output. */
const scriptsAnswer = (queue = QUEUE, sessions = SESSIONS) => (file, args) => {
  const name = args[0] ?? '';
  if (name.endsWith('queue.mjs')) return { code: 0, stdout: JSON.stringify(queue), stderr: '' };
  if (name.endsWith('sessions.mjs')) return { code: 0, stdout: JSON.stringify(sessions), stderr: '' };
  return { code: 0, stdout: 'ok-out', stderr: '' };
};

function setup({ files, answer, sessions, today } = {}) {
  const runner = fakeRunner(answer ?? scriptsAnswer());
  const fs = fakeFs({
    [`${WT}/intents/52-orch/metadata.yml`]: metaText(),
    [`${WT}/intents/52-orch/spec.md`]: 'spec',
    [`${ROOT}/intents/29-grid/metadata.yml`]: metaText({ id: '29', slug: 'grid', status: 'draft', intent_accepted: '' }),
    'C:/pub/index.html': '<html></html>',
    'C:/pub/app.js': 'x',
    'C:/pub/style.css': 'y',
    ...files,
  });
  const handle = createHandler({ runner, fs, sessions, root: ROOT, port: PORT, publicDir: 'C:/pub', today: today ?? (() => '2026-10-24') });
  return { runner, fs, handle };
}

const get = (url, over = {}) => ({ method: 'GET', url, host: HOST, ...over });
const post = (url, body, over = {}) => ({ method: 'POST', url, host: HOST, origin: ORIGIN, body: body === undefined ? undefined : JSON.stringify(body), ...over });
const payload = (res) => JSON.parse(res.body);

describe('Host and Origin (spec B2, AC3)', () => {
  const routes = [
    get('/api/state'),
    get('/'),
    get('/api/sessions'),
    post('/api/spawn/52'),
    post('/api/remove/52'),
    post('/api/gate/29/intent_accepted'),
    post('/api/ship/52?dry=1'),
    post('/api/ship/52', { live: 'x' }),
    post('/api/sessions', { role: 'auto', id: '52' }),
  ];

  it('answers 403 and runs nothing for a foreign Host on every route', async () => {
    for (const hostile of ['evil.example', `evil.example:${PORT}`, 'localhost:5173', 'localhost']) {
      for (const r of routes) {
        const { runner, fs, handle } = setup();
        const res = await handle({ ...r, host: hostile });
        expect(res.status, `${r.method} ${r.url} ${hostile}`).toBe(403);
        expect(runner.calls).toEqual([]);
        expect(fs.writes).toEqual([]);
      }
    }
  });

  it('answers 403 for a foreign Origin with a matching Host, running nothing', async () => {
    for (const r of routes) {
      const { runner, fs, handle } = setup();
      const res = await handle({ ...r, origin: 'http://evil.example' });
      expect(res.status, `${r.method} ${r.url}`).toBe(403);
      expect(runner.calls).toEqual([]);
      expect(fs.writes).toEqual([]);
    }
  });

  it('answers 403 for a POST without any Origin, running nothing', async () => {
    for (const r of routes.filter((x) => x.method === 'POST')) {
      const { runner, handle } = setup();
      expect((await handle({ ...r, origin: undefined })).status, r.url).toBe(403);
      expect(runner.calls).toEqual([]);
    }
  });

  it('refuses other methods', async () => {
    const { runner, handle } = setup();
    expect((await handle({ method: 'DELETE', url: '/api/spawn/52', host: HOST, origin: ORIGIN })).status).toBe(405);
    expect(runner.calls).toEqual([]);
  });
});

describe('ids and gates are validated before anything runs', () => {
  it('answers 400 for a non-digit id on spawn, remove, gate and ship', async () => {
    for (const bad of ['5a', '52%20--x', 'x', '5.2', '52;ls']) {
      for (const url of [`/api/spawn/${bad}`, `/api/remove/${bad}`, `/api/gate/${bad}/plan_approved`, `/api/ship/${bad}?dry=1`, `/api/ship/${bad}`]) {
        const { runner, handle } = setup();
        expect((await handle(post(url, {}))).status, url).toBe(400);
        expect(runner.calls).toEqual([]);
      }
    }
  });
  it('answers 400 for a key that is not a gate', async () => {
    const { runner, handle } = setup();
    expect((await handle(post('/api/gate/52/status'))).status).toBe(400);
    expect(runner.calls).toEqual([]);
  });
});

describe('spawn and remove (spec B4)', () => {
  it('runs exactly node scripts/spawn-intent.mjs <id> in the main checkout', async () => {
    const { runner, handle } = setup();
    const res = await handle(post('/api/spawn/52'));
    expect(runner.calls).toEqual([{ cmd: script('spawn-intent.mjs', '52'), cwd: ROOT }]);
    expect(payload(res)).toEqual({ ok: true, code: 0, output: 'ok-out' });
  });
  it('remove adds --remove as its own argument', async () => {
    const { runner, handle } = setup();
    await handle(post('/api/remove/52'));
    expect(runner.calls).toEqual([{ cmd: script('spawn-intent.mjs', '52', '--remove'), cwd: ROOT }]);
  });
  it('reports a script failure with its output instead of hiding it', async () => {
    const { handle } = setup({ answer: () => ({ code: 1, stdout: '', stderr: 'refused: unmerged' }) });
    expect(payload(await handle(post('/api/remove/52')))).toEqual({ ok: false, code: 1, output: 'refused: unmerged' });
  });
  it('allows one write at a time per intent, and a different intent meanwhile', async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    const { runner, handle } = setup({
      answer: async () => {
        await gate;
        return { code: 0, stdout: '', stderr: '' };
      },
    });
    const first = handle(post('/api/spawn/52'));
    await Promise.resolve();
    expect((await handle(post('/api/spawn/52'))).status).toBe(409);
    const other = handle(post('/api/spawn/53'));
    release();
    expect((await first).status).toBe(200);
    expect((await other).status).toBe(200);
    expect(runner.calls.map((c) => c.cmd.at(-1))).toEqual(['52', '53']);
  });
});

describe('GET /api/state (spec B3)', () => {
  it('runs queue --json and sessions --json and derives each next step, the owner first', async () => {
    const { runner, handle } = setup();
    const res = await handle(get('/api/state'));
    expect(runner.calls.map((c) => c.cmd).sort()).toEqual([script('queue.mjs', '--json'), script('sessions.mjs', '--json')].sort());
    const body = payload(res);
    expect(body.intents.map((i) => [i.id, i.next.step, i.next.owner])).toEqual([
      [29, 'Accept the intent', 'owner'],
      [52, 'Accept the spec', 'owner'],
      [51, 'Nothing: done', 'none'],
    ]);
    expect(body.intents.find((i) => i.id === 52).worktree).toEqual({ exists: true, path: WT, branch: 'feat/52-orch', session: 'working' });
  });
  it('reports a failing script as 500 with its message', async () => {
    const { handle } = setup({ answer: () => ({ code: 1, stdout: '', stderr: 'boom' }) });
    const res = await handle(get('/api/state'));
    expect(res.status).toBe(500);
    expect(payload(res).error).toContain('boom');
  });
});

describe('gate buttons (spec B8)', () => {
  it('writes a bare date on the worktree metadata.yml and commits only that file', async () => {
    const { runner, fs, handle } = setup();
    const res = await handle(post('/api/gate/52/spec_accepted'));
    expect(payload(res)).toEqual({ ok: true, output: '§52: spec_accepted recorded (orchestrator)' });
    expect(fs.writes).toEqual([[`${WT}/intents/52-orch/metadata.yml`, metaText({ spec_accepted: '2026-10-24' })]]);
    const rel = 'intents/52-orch/metadata.yml';
    const gitCalls = runner.calls.filter((c) => c.cmd[0] === 'git');
    expect(gitCalls).toEqual([
      { cmd: ['git', 'add', '--', rel], cwd: WT },
      { cmd: ['git', 'commit', '-m', '§52: spec_accepted recorded (orchestrator)', '--', rel], cwd: WT },
    ]);
    expect(gitCalls.some((c) => c.cmd.includes('--author') || c.cmd.some((a) => /Co-Authored/.test(a)))).toBe(false);
  });
  it('writes on main, in the main checkout, for an intent without a branch', async () => {
    const { runner, fs, handle } = setup();
    await handle(post('/api/gate/29/intent_accepted'));
    expect(fs.writes).toEqual([[`${ROOT}/intents/29-grid/metadata.yml`, metaText({ id: '29', slug: 'grid', status: 'draft', intent_accepted: '2026-10-24' })]]);
    expect(runner.calls.filter((c) => c.cmd[0] === 'git').map((c) => c.cwd)).toEqual([ROOT, ROOT]);
  });
  it('refuses a gate whose precondition fails, writing and committing nothing', async () => {
    const { runner, fs, handle } = setup();
    const res = await handle(post('/api/gate/52/plan_approved')); // spec not accepted, no plan.md
    expect(res.status).toBe(409);
    expect(payload(res).error).toBe('spec_accepted comes first');
    expect(fs.writes).toEqual([]);
    expect(runner.calls.filter((c) => c.cmd[0] === 'git')).toEqual([]);
  });
  it('refuses a gate already recorded', async () => {
    const { fs, handle } = setup();
    expect((await handle(post('/api/gate/52/intent_accepted'))).status).toBe(409);
    expect(fs.writes).toEqual([]);
  });
  it('records live_checked only when the review says owed', async () => {
    const files = { [`${WT}/intents/52-orch/review.md`]: 'verdict: attest\nlive-check: owed\n\n## Passes\n' };
    const { fs, handle } = setup({ files });
    expect((await handle(post('/api/gate/52/live_checked'))).status).toBe(200);
    expect(fs.writes[0][1]).toContain('live_checked: 2026-10-24\n');
    const plain = setup();
    expect((await plain.handle(post('/api/gate/52/live_checked'))).status).toBe(409);
  });
  it('refuses a branch with no worktree, and an unknown intent', async () => {
    const { runner, fs, handle } = setup({ answer: scriptsAnswer(QUEUE, []) });
    expect((await handle(post('/api/gate/52/spec_accepted'))).status).toBe(409);
    expect((await handle(post('/api/gate/99/spec_accepted'))).status).toBe(404);
    expect(fs.writes).toEqual([]);
    const writing = runner.calls.filter((c) => c.cmd[0] === 'git' && ['add', 'commit', 'reset'].includes(c.cmd[1]));
    expect(writing).toEqual([]);
  });
  it('refuses while a session runs on the intent', async () => {
    const sessions = { runningFor: (id) => id === '52' };
    const { runner, fs, handle } = setup({ sessions });
    expect((await handle(post('/api/gate/52/spec_accepted'))).status).toBe(409);
    expect(fs.writes).toEqual([]);
    expect(runner.calls).toEqual([]);
  });
  it('puts the file back when git refuses the commit', async () => {
    const answer = (file, args, opts) => (file === 'git' && args[0] === 'commit' ? { code: 1, stdout: '', stderr: 'hook failed' } : scriptsAnswer()(file, args, opts));
    const { runner, fs, handle } = setup({ answer });
    const res = await handle(post('/api/gate/52/spec_accepted'));
    expect(res.status).toBe(500);
    expect(fs.map.get(`${WT}/intents/52-orch/metadata.yml`)).toBe(metaText());
    expect(runner.calls.at(-1).cmd).toEqual(['git', 'reset', '-q', '--', 'intents/52-orch/metadata.yml']);
  });
});

describe('ship (spec B9)', () => {
  const dry = ['ship.mjs', '52', '--dry-run'];
  it('refuses the real ship without a successful dry-run first, running nothing', async () => {
    const { runner, handle } = setup();
    const res = await handle(post('/api/ship/52', { live: 'ran it' }));
    expect(res.status).toBe(409);
    expect(runner.calls).toEqual([]);
  });
  it('runs the dry-run, then the real ship with the words as one argument, and only once', async () => {
    const { runner, handle } = setup();
    await handle(post('/api/ship/52?dry=1'));
    const words = 'I ran it "twice"; rm -rf / && echo $HOME --trailer x';
    const res = await handle(post('/api/ship/52', { live: `  ${words}  ` }));
    expect(payload(res).ok).toBe(true);
    expect(runner.calls).toEqual([
      { cmd: script(...dry), cwd: ROOT },
      { cmd: script('ship.mjs', '52', '--live-checked', words), cwd: ROOT },
    ]);
    expect((await handle(post('/api/ship/52', {}))).status).toBe(409); // the dry-run was consumed
    expect(runner.calls).toHaveLength(2);
  });
  it('runs the real ship without --live-checked when no words are given', async () => {
    const { runner, handle } = setup();
    await handle(post('/api/ship/52?dry=1'));
    await handle(post('/api/ship/52', {}));
    expect(runner.calls[1].cmd).toEqual(script('ship.mjs', '52'));
  });
  it('a dry-run that fails does not unlock the real ship', async () => {
    const { runner, handle } = setup({ answer: () => ({ code: 1, stdout: 'precondition: not reviewed', stderr: '' }) });
    const res = await handle(post('/api/ship/52?dry=1'));
    expect(payload(res)).toEqual({ ok: false, code: 1, output: 'precondition: not reviewed' });
    expect((await handle(post('/api/ship/52', {}))).status).toBe(409);
    expect(runner.calls).toHaveLength(1);
  });
  it('a dry-run for one id does not unlock another', async () => {
    const { runner, handle } = setup();
    await handle(post('/api/ship/52?dry=1'));
    expect((await handle(post('/api/ship/53', {}))).status).toBe(409);
    expect(runner.calls).toHaveLength(1);
  });
  it('refuses overlong words and bad bodies before running the real ship', async () => {
    const { runner, handle } = setup();
    await handle(post('/api/ship/52?dry=1'));
    expect((await handle(post('/api/ship/52', { live: 'x'.repeat(501) }))).status).toBe(400);
    expect((await handle({ ...post('/api/ship/52'), body: '[1]' })).status).toBe(400);
    expect((await handle({ ...post('/api/ship/52'), body: '{nope' })).status).toBe(400);
    expect((await handle({ ...post('/api/ship/52'), bodyTooLarge: true })).status).toBe(413);
    expect(runner.calls).toHaveLength(1);
  });
  it('refuses while a session runs on the intent', async () => {
    const { runner, handle } = setup({ sessions: { runningFor: () => true } });
    expect((await handle(post('/api/ship/52?dry=1'))).status).toBe(409);
    expect(runner.calls).toEqual([]);
  });
});

describe('static page', () => {
  it('serves only the three page files, with a CSP and no sniffing', async () => {
    const { handle } = setup();
    const res = await handle(get('/'));
    expect(res.status).toBe(200);
    expect(res.body).toBe('<html></html>');
    expect(res.headers['Content-Type']).toContain('text/html');
    expect(res.headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect((await handle(get('/app.js'))).status).toBe(200);
    expect((await handle(get('/style.css'))).status).toBe(200);
    for (const bad of ['/../server.mjs', '/package.json', '/%2e%2e/x', '/api/nothing']) {
      expect((await handle(get(bad))).status, bad).toBe(404);
    }
  });
});

describe('session routes (spec B5, B6)', () => {
  const fakeSessions = () => {
    const calls = [];
    return {
      calls,
      runningFor: () => false,
      list: () => [{ id: 's1' }],
      has: (sid) => sid === 's1',
      launch: (a) => {
        calls.push(['launch', a]);
        return { id: 's1', ...a };
      },
      answer: (sid, rid, result) => {
        calls.push(['answer', sid, rid, result]);
        return rid === 'r1';
      },
      stop: (sid) => {
        calls.push(['stop', sid]);
        return sid === 's1';
      },
      subscribe: () => () => {},
    };
  };

  it('is 404 when there is no session manager', async () => {
    const { handle } = setup();
    expect((await handle(get('/api/sessions'))).status).toBe(404);
    expect((await handle(post('/api/sessions', { role: 'auto', id: '52' }))).status).toBe(404);
  });
  it('launches a reviewer in the main checkout with /review <id>', async () => {
    const sessions = fakeSessions();
    const { handle } = setup({ sessions });
    const res = await handle(post('/api/sessions', { role: 'reviewer', id: '52' }));
    expect(res.status).toBe(200);
    expect(sessions.calls).toEqual([['launch', { role: 'reviewer', id: '52', cwd: ROOT, prompt: '/review 52' }]]);
  });
  it('launches an implementer in the worktree', async () => {
    const sessions = fakeSessions();
    const { handle } = setup({ sessions });
    await handle(post('/api/sessions', { role: 'implementer', id: '52' }));
    expect(sessions.calls[0][1].cwd).toBe(WT);
    expect(sessions.calls[0][1].prompt).toContain('intent §52 (orch)');
  });
  it('refuses an implementer without a worktree, an unknown role, a bad id and a second session', async () => {
    const sessions = fakeSessions();
    const noWt = setup({ sessions, answer: scriptsAnswer(QUEUE, []) });
    expect((await noWt.handle(post('/api/sessions', { role: 'implementer', id: '52' }))).status).toBe(409);
    const { handle } = setup({ sessions });
    expect((await handle(post('/api/sessions', { role: 'shell', id: '52' }))).status).toBe(400);
    expect((await handle(post('/api/sessions', { role: 'auto', id: '5a' }))).status).toBe(400);
    const busy = setup({ sessions: { ...fakeSessions(), runningFor: () => true } });
    expect((await busy.handle(post('/api/sessions', { role: 'auto', id: '52' }))).status).toBe(409);
    expect(sessions.calls).toEqual([]);
  });
  it('passes an answer through only when it is well formed', async () => {
    const sessions = fakeSessions();
    const { handle } = setup({ sessions });
    const good = { requestId: 'r1', result: { behavior: 'deny', message: 'no' } };
    expect((await handle(post('/api/sessions/s1/answer', good))).status).toBe(200);
    expect(sessions.calls).toEqual([['answer', 's1', 'r1', { behavior: 'deny', message: 'no' }]]);
    for (const bad of [
      { requestId: 'r1', result: { behavior: 'maybe' } },
      { requestId: 'r1', result: { behavior: 'allow', extra: 1 } },
      { requestId: 'r1', result: { behavior: 'allow', updatedInput: [] } },
      { requestId: 'r1' },
      { result: { behavior: 'allow' } },
    ]) {
      expect((await handle(post('/api/sessions/s1/answer', bad))).status).toBe(400);
    }
    expect((await handle(post('/api/sessions/s1/answer', { requestId: 'zz', result: { behavior: 'allow' } }))).status).toBe(404);
  });
  it('stops a session and 404s an unknown one', async () => {
    const sessions = fakeSessions();
    const { handle } = setup({ sessions });
    expect((await handle(post('/api/sessions/s1/stop'))).status).toBe(200);
    expect((await handle(post('/api/sessions/s2/stop'))).status).toBe(404);
    expect((await handle(post('/api/sessions/../stop'))).status).toBe(404);
    expect((await handle(post('/api/sessions/x1/stop'))).status).toBe(400);
  });
  it('streams events over SSE only for a known session', async () => {
    const { handle } = setup({ sessions: fakeSessions() });
    const ok = await handle(get('/api/sessions/s1/events'));
    expect(ok.status).toBe(200);
    expect(typeof ok.sse).toBe('function');
    expect((await handle(get('/api/sessions/s9/events'))).status).toBe(404);
  });
});
