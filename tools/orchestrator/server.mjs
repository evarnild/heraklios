// The orchestrator's request handler (spec §52 B1-B4, B8, B9, B12): a pure
// function from a request description to a response, with the process runner,
// the file system and the session manager injected, so the tests run no git,
// no script and no SDK. orchestrator.mjs wires the real ones to node:http.
//
// Safety, in order, on every request: Host (DNS rebinding), then, for POST,
// an Origin that must be present and equal to the server's own (stricter than
// server/saveApi.ts, which lets a missing Origin through: spec B2 says a
// request that changes something carries one, and a browser always sends it
// on POST). Commands are `{file, args}` arrays handed to execFile-style
// runners: no shell ever sees an id or the owner's words.
import { join } from 'node:path';
import { createActions } from './actions.mjs';
import { foreignHost, foreignOrigin, validId } from './orchestrator-lib.mjs';
import { sessionRoutes } from './session-routes.mjs';
import { loadState } from './state.mjs';

const MAX_BODY = 64 * 1024;
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
};
const PAGE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  // Belt and braces for the page's own rule (textContent only): no inline script, no foreign origin.
  'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

export const json = (status, value) => ({
  status,
  headers: { ...PAGE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(value),
});
const refuse = (status, error) => json(status, { ok: false, error });
const output = (out) => `${out.stdout}${out.stderr}`.trim();

function localDate(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** The checks every route passes before anything else; null when the request may go on. */
export function guard(request, port) {
  if (foreignHost(request, port)) return refuse(403, 'Foreign Host');
  const post = request.method === 'POST';
  if (post && request.origin === undefined) return refuse(403, 'POST needs an Origin');
  if (foreignOrigin(request)) return refuse(403, 'Foreign Origin');
  if (request.method !== 'GET' && request.method !== 'HEAD' && !post) return refuse(405, 'Method not allowed');
  return null;
}

function parseBody(request) {
  if (request.bodyTooLarge || (request.body ?? '').length > MAX_BODY) return { error: refuse(413, 'Body too large') };
  if (!request.body) return { value: {} };
  try {
    const value = JSON.parse(request.body);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return { value };
  } catch {
    return { error: refuse(400, 'Body is not a JSON object') };
  }
}

export function createHandler(deps) {
  const { fs, port, publicDir } = deps;
  const sessions = deps.sessions ?? null;
  const today = deps.today ?? localDate;

  const actions = createActions({ deps, sessions, today, json, refuse, output, parseBody });
  const { exclusive, running, spawnRoute, shipRoute, gateRoute } = actions;

  async function staticFile(pathname) {
    const entry = STATIC[pathname];
    if (!entry) return refuse(404, 'Not found');
    const text = await fs.readFile(join(publicDir, entry[0]));
    if (text === null) return refuse(404, 'Not found');
    return { status: 200, headers: { ...PAGE_HEADERS, 'Content-Type': entry[1] }, body: text };
  }

  const extra = sessionRoutes({ deps, sessions, running, exclusive, parseBody, refuse });

  return async function handle(request) {
    const denied = guard(request, port);
    if (denied) return denied;
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;
    const get = request.method === 'GET' || request.method === 'HEAD';
    try {
      if (get && path === '/api/state') return json(200, await loadState(deps));
      if (get) {
        const routed = await extra.get(path);
        if (routed) return routed;
        return await staticFile(path);
      }
      let m = /^\/api\/(spawn|remove)\/([^/]+)$/.exec(path);
      if (m) return validId(m[2]) ? await spawnRoute(m[2], m[1] === 'remove' ? '--remove' : null) : refuse(400, 'Bad id');
      m = /^\/api\/ship\/([^/]+)$/.exec(path);
      if (m) return validId(m[1]) ? await shipRoute(m[1], url.searchParams.get('dry') === '1', request) : refuse(400, 'Bad id');
      m = /^\/api\/gate\/([^/]+)\/([a-z_]+)$/.exec(path);
      if (m) return validId(m[1]) ? await gateRoute(m[1], m[2]) : refuse(400, 'Bad id');
      return (await extra.post(path, request)) ?? refuse(404, 'Not found');
    } catch (e) {
      return refuse(500, e instanceof Error ? e.message : String(e));
    }
  };
}
