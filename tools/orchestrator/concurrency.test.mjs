// The write locks (spec §52 B4-B6, plan Risks): one session or write at a time
// per intent, and one ship or main-checkout write at a time overall. These
// tests fire requests concurrently against the handler with fakes.
import { describe, expect, it } from 'vitest';
import { createHandler } from './server.mjs';
import { createSessionManager } from './sdk-sessions.mjs';

const ROOT = 'C:/repo';
const WT = 'C:/wt/52-orch';
const PORT = 5299;
const HOST = `127.0.0.1:${PORT}`;
const norm = (p) => p.replace(/\\/g, '/');

const meta = (id, slug, status, accepted) =>
  `id: ${id}\nslug: ${slug}\ntype: feature\nstatus: ${status}\nintent_accepted: ${accepted}\nspec_accepted: \nplan_approved: \nlive_checked: \n`;
const QUEUE = {
  inFlight: [{ id: 52, slug: 'orch', title: 'O', type: 'feature', status: 'accepted', gates: 'I--', auto: '', source: 'branch', merged: null }],
  queued: [{ id: 29, slug: 'grid', title: 'G', type: 'feature', status: 'draft', gates: '---', auto: '', source: 'main', merged: null }],
};
const SESSIONS = [{ id: '52', branch: 'feat/52-orch', path: WT, status: 'accepted', session: { state: 'working' } }];

function setup({ sessions, hold, queueDelays = [] } = {}) {
  const calls = [];
  let queues = 0;
  const files = new Map(
    Object.entries({
      [`${WT}/intents/52-orch/metadata.yml`]: meta('52', 'orch', 'accepted', '2026-10-23'),
      [`${WT}/intents/52-orch/spec.md`]: 'spec',
      [`${ROOT}/intents/29-grid/metadata.yml`]: meta('29', 'grid', 'draft', ''),
    }),
  );
  const writes = [];
  const runner = {
    async run(file, args) {
      calls.push([file, ...args]);
      const name = norm(args[0] ?? '');
      if (name.endsWith('queue.mjs')) await new Promise((r) => setTimeout(r, queueDelays[queues++] ?? 0));
      if (name.endsWith('queue.mjs')) return { code: 0, stdout: JSON.stringify(QUEUE), stderr: '' };
      if (name.endsWith('sessions.mjs')) return { code: 0, stdout: JSON.stringify(SESSIONS), stderr: '' };
      if (hold && name.endsWith('ship.mjs') && args.length === 2 && args[1] === hold.id) await hold.promise;
      return { code: 0, stdout: 'ok', stderr: '' };
    },
  };
  const fs = {
    readFile: async (p) => files.get(norm(p)) ?? null,
    exists: async (p) => files.has(norm(p)),
    writeFile: async (p) => void writes.push(norm(p)),
  };
  const handle = createHandler({ runner, fs, sessions, root: ROOT, port: PORT, publicDir: 'C:/pub', today: () => '2026-10-24' });
  return { calls, writes, handle };
}

const post = (url, body) => ({ method: 'POST', url, host: HOST, origin: `http://${HOST}`, body: body === undefined ? undefined : JSON.stringify(body) });
const shipCalls = (calls) => calls.filter((c) => norm(c[1] ?? '').endsWith('ship.mjs'));

/** A manager whose running state flips to true after `n` checks: a session launched in a gap. */
const flipping = (n) => {
  let seen = 0;
  return { runningFor: () => ++seen > n };
};

describe('one session per intent, also under a race', () => {
  it('two concurrent launches on one intent give one 200, one 409 and one query()', async () => {
    let queries = 0;
    const query = () => {
      queries++;
      return { [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }), interrupt: async () => {} };
    };
    const sessions = createSessionManager({ query });
    // The second request's state load ends after the first launch finished: only the in-lock check can refuse it.
    const { handle } = setup({ sessions, queueDelays: [0, 30] });
    const launch = () => handle(post('/api/sessions', { role: 'reviewer', id: '52' }));
    const statuses = (await Promise.all([launch(), launch()])).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(queries).toBe(1);
    expect(sessions.list()).toHaveLength(1);
  });
  it('a gate is refused when a session appears after the early check', async () => {
    const { handle, writes, calls } = setup({ sessions: flipping(1) });
    expect((await handle(post('/api/gate/52/spec_accepted'))).status).toBe(409);
    expect(writes).toEqual([]);
    expect(calls.filter((c) => c[0] === 'git')).toEqual([]);
  });
  it('a dry-run and a real ship are refused when a session appears after the early check', async () => {
    const dry = setup({ sessions: flipping(1) });
    expect((await dry.handle(post('/api/ship/52?dry=1'))).status).toBe(409);
    expect(shipCalls(dry.calls)).toEqual([]);
    // The real ship needs a dry-run first: the manager flips on its third check.
    const real = setup({ sessions: flipping(3) });
    expect((await real.handle(post('/api/ship/52?dry=1'))).status).toBe(200);
    expect((await real.handle(post('/api/ship/52', {}))).status).toBe(409);
    expect(shipCalls(real.calls)).toHaveLength(1);
  });
});

describe('the overlay after the SDK aborts a parked request (F14)', () => {
  it('the intent is needs you while a request is parked and not after the abort', async () => {
    let canUseTool;
    const query = (params) => {
      canUseTool = params.options.canUseTool;
      return { [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }), interrupt: async () => {} };
    };
    const sessions = createSessionManager({ query });
    const { handle } = setup({ sessions });
    const state = async () => JSON.parse((await handle({ method: 'GET', url: '/api/state', host: HOST })).body).intents.find((i) => i.id === 52);
    expect((await handle(post('/api/sessions', { role: 'reviewer', id: '52' }))).status).toBe(200);
    const ac = new AbortController();
    const parked = canUseTool('Bash', {}, { signal: ac.signal });
    expect((await state()).session).toBe('needs you');
    ac.abort();
    await parked;
    expect((await state()).session).not.toBe('needs you');
  });
});

describe('the main lock: one ship or main-checkout write at a time', () => {
  async function withShipInFlight(fn) {
    let release;
    const hold = { id: '52', promise: new Promise((r) => (release = r)) };
    const ctx = setup({ hold });
    // 53 needs its own dry-run so that only the lock can refuse it.
    expect((await ctx.handle(post('/api/ship/53?dry=1'))).status).toBe(200);
    expect((await ctx.handle(post('/api/ship/52?dry=1'))).status).toBe(200);
    const inFlight = ctx.handle(post('/api/ship/52', {}));
    await Promise.resolve();
    try {
      await fn(ctx);
    } finally {
      release();
      expect((await inFlight).status).toBe(200);
    }
  }

  it('refuses a ship and a dry-run of another intent while a real ship runs', async () => {
    await withShipInFlight(async ({ handle, calls }) => {
      const before = shipCalls(calls).length;
      expect((await handle(post('/api/ship/53', {}))).status).toBe(409);
      expect((await handle(post('/api/ship/53?dry=1'))).status).toBe(409);
      expect(shipCalls(calls)).toHaveLength(before);
    });
  });
  it('refuses a gate on a main-located intent while a ship runs', async () => {
    await withShipInFlight(async ({ handle, writes, calls }) => {
      expect((await handle(post('/api/gate/29/intent_accepted'))).status).toBe(409);
      expect(writes).toEqual([]);
      expect(calls.filter((c) => c[0] === 'git')).toEqual([]);
    });
  });
});

