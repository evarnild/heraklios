// The session routes of the orchestrator (spec §52 B5, B6), split from
// server.mjs to keep both small. They only validate and delegate to the
// injected session manager (sdk-sessions.mjs); with no manager they are 404.
import { join } from 'node:path';
import { portFor } from '../../scripts/session-lib.mjs';
import { roleLaunch, ROLES, validId } from './orchestrator-lib.mjs';
import { findIntent, loadState } from './state.mjs';

const SID = /^s[0-9]+$/;
const RESULT_KEYS = new Set(['behavior', 'message', 'updatedInput']);

/** A permission answer from the page: `{behavior:'allow'|'deny', message?, updatedInput?}` and nothing else. */
export function validAnswer(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some((k) => !RESULT_KEYS.has(k))) return null;
  if (value.behavior !== 'allow' && value.behavior !== 'deny') return null;
  if (value.message !== undefined && typeof value.message !== 'string') return null;
  const input = value.updatedInput;
  if (input !== undefined && (input === null || typeof input !== 'object' || Array.isArray(input))) return null;
  return value;
}

export function sessionRoutes({ deps, sessions, running, exclusive, parseBody, refuse }) {
  const ok = (value) => ({
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(value),
  });

  async function launch(request) {
    const parsed = parseBody(request);
    if (parsed.error) return parsed.error;
    const { role, id } = parsed.value;
    if (!ROLES.includes(role)) return refuse(400, 'Unknown role');
    if (!validId(id)) return refuse(400, 'Bad id');
    if (running(id)) return refuse(409, `A session is already running on §${id}`);
    const intent = findIntent(await loadState(deps), id);
    if (!intent) return refuse(404, `No intent ${id}`);
    const worktreePath = intent.worktree.path ?? undefined;
    if (role === 'implementer' && !worktreePath) return refuse(409, `§${id} has no worktree: spawn it first`);
    const brief = worktreePath ? await deps.fs.readFile(join(worktreePath, 'CLAUDE.local.md')) : null;
    const { cwd, prompt } = roleLaunch(role, {
      id,
      slug: intent.slug,
      worktreePath,
      mainPath: deps.root,
      brief: brief ?? undefined,
      branch: intent.worktree.branch ?? undefined,
      port: portFor(id),
    });
    // Held only while the session is registered: the manager then answers runningFor(id).
    // Re-checked inside the lock: another launch may have registered while the state loaded.
    return exclusive([id], async () => {
      if (running(id)) return refuse(409, `A session is already running on §${id}`);
      return ok({ ok: true, session: sessions.launch({ role, id, cwd, prompt }) });
    });
  }

  async function answer(sid, request) {
    const parsed = parseBody(request);
    if (parsed.error) return parsed.error;
    const result = validAnswer(parsed.value.result);
    if (typeof parsed.value.requestId !== 'string' || !result) return refuse(400, 'Bad answer');
    return sessions.answer(sid, parsed.value.requestId, result) ? ok({ ok: true }) : refuse(404, 'No such pending request');
  }

  return {
    async get(path) {
      if (!sessions) return null;
      if (path === '/api/sessions') return ok({ sessions: sessions.list() });
      const m = /^\/api\/sessions\/([^/]+)\/events$/.exec(path);
      if (!m || !SID.test(m[1])) return null;
      if (!sessions.has(m[1])) return refuse(404, 'No such session');
      return {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
        sse: (send) => sessions.subscribe(m[1], send),
      };
    },
    async post(path, request) {
      if (!sessions) return null;
      if (path === '/api/sessions') return launch(request);
      const m = /^\/api\/sessions\/([^/]+)\/(answer|stop)$/.exec(path);
      if (!m) return null;
      if (!SID.test(m[1])) return refuse(400, 'Bad session id');
      if (m[2] === 'answer') return answer(m[1], request);
      return sessions.stop(m[1]) ? ok({ ok: true }) : refuse(404, 'No such session');
    },
  };
}
