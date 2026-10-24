// The write actions behind the orchestrator's POST routes (spec §52 B4, B8,
// B9): spawn/remove, the gate click and ship. Split from server.mjs so each
// stays small. Everything runs through the injected runner and file system.
import { join } from 'node:path';
import { GATE_FIELDS, parseMetadata, parseReviewHeader } from '../../scripts/intent-check-lib.mjs';
import { gateAllowed, gateWrite } from './orchestrator-lib.mjs';
import { findIntent, loadState, scriptCall } from './state.mjs';

const MAX_WORDS = 500;

/** `refuse`, `json`, `output`, `parseBody` and `today` come from server.mjs. */
export function createActions({ deps, sessions, today, json, refuse, output, parseBody }) {
  const { runner, fs, root } = deps;
  const busy = new Set();
  const dryRuns = new Set();

  /** Runs `fn` holding one write lock per key; a key already held gives 409 and runs nothing. */
  async function exclusive(keys, fn) {
    if (keys.some((k) => busy.has(k))) return refuse(409, 'Another write is running for this intent');
    keys.forEach((k) => busy.add(k));
    try {
      return await fn();
    } finally {
      keys.forEach((k) => busy.delete(k));
    }
  }

  const running = (id) => (sessions ? sessions.runningFor(id) : false);
  const stopFirst = (id) => refuse(409, `A session is running on §${id}: stop it first`);

  async function script(name, args) {
    const call = scriptCall(root, name, args);
    const out = await runner.run(call.file, call.args, { cwd: call.cwd });
    return json(200, { ok: out.code === 0, code: out.code, output: output(out) });
  }

  // A remove would pull the worktree out from under a running session, so it waits for Stop.
  const spawnRoute = (id, flag) =>
    exclusive([id], () => (flag && running(id) ? stopFirst(id) : script('spawn-intent.mjs', flag ? [id, flag] : [id])));

  async function shipRoute(id, dry, request) {
    if (running(id)) return stopFirst(id);
    if (dry) {
      return exclusive([id, 'main'], async () => {
        if (running(id)) return stopFirst(id); // re-checked inside the lock: a session may have launched meanwhile
        const res = await script('ship.mjs', [id, '--dry-run']);
        if (JSON.parse(res.body).ok) dryRuns.add(id);
        else dryRuns.delete(id);
        return res;
      });
    }
    const parsed = parseBody(request);
    if (parsed.error) return parsed.error;
    const words = typeof parsed.value.live === 'string' ? parsed.value.live.trim() : '';
    if (words.length > MAX_WORDS) return refuse(400, 'Live check words are too long');
    if (!dryRuns.has(id)) return refuse(409, 'Run the dry-run first');
    return exclusive([id, 'main'], async () => {
      if (running(id)) return stopFirst(id);
      dryRuns.delete(id);
      return script('ship.mjs', words ? [id, '--live-checked', words] : [id]);
    });
  }

  async function gateRoute(id, gate) {
    if (!GATE_FIELDS.includes(gate)) return refuse(400, 'Not a gate');
    if (running(id)) return stopFirst(id);
    const state = await loadState(deps);
    const intent = findIntent(state, id);
    if (!intent) return refuse(404, `No intent ${id}`);
    if (intent.location.kind === 'branch') return refuse(409, `§${id} has a branch but no worktree: spawn it first`);
    const base = intent.location.base;
    const rel = `intents/${intent.id}-${intent.slug}/metadata.yml`;
    const keys = intent.location.kind === 'main' ? [id, 'main'] : [id];
    return exclusive(keys, () => (running(id) ? stopFirst(id) : writeGate({ id, gate, base, rel })));
  }

  async function writeGate({ id, gate, base, rel }) {
    const dir = rel.slice(0, rel.lastIndexOf('/'));
    const original = await fs.readFile(join(base, rel));
    if (original === null) return refuse(404, 'metadata.yml not found');
    const review = await fs.readFile(join(base, dir, 'review.md'));
    const verdict = gateAllowed(gate, {
      metadata: parseMetadata(original),
      specExists: await fs.exists(join(base, dir, 'spec.md')),
      planExists: await fs.exists(join(base, dir, 'plan.md')),
      reviewHeader: review === null ? null : parseReviewHeader(review),
    });
    if (!verdict.ok) return refuse(409, verdict.reason);
    await fs.writeFile(join(base, rel), gateWrite(original, gate, today()));
    const message = `§${id}: ${gate} recorded (orchestrator)`;
    const add = await runner.run('git', ['add', '--', rel], { cwd: base });
    const commit = add.code === 0 ? await runner.run('git', ['commit', '-m', message, '--', rel], { cwd: base }) : add;
    if (commit.code === 0) return json(200, { ok: true, output: message });
    await fs.writeFile(join(base, rel), original);
    await runner.run('git', ['reset', '-q', '--', rel], { cwd: base });
    return json(500, { ok: false, error: `git failed: ${output(commit)}` });
  }

  return { exclusive, running, spawnRoute, shipRoute, gateRoute };
}
