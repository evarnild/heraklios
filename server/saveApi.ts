// The save API's request handling (intents/45-save-api, spec B3, B4, B9).
// Pure: no Node http, no fs, no Vite. The file system comes in through the
// `SaveFs` interface, so every rule below is tested against an in-memory one
// (`saveApi.test.ts`). The plugin (`saveApiPlugin.ts`) only adapts Node's
// request and response to this function.
//
// No game rule lives here: this is storage only. The one engine import is
// `parseSavedGame`, used to validate a save before it is written and after
// it is read.
import { parseSavedGame } from '../src/engine/saveGame';

/** The only slot names that ever reach the file system (spec B3). */
export const SLOTS = ['1', '2', '3', '4', '5', '6', 'autosave'] as const;
export type Slot = (typeof SLOTS)[number];

/** Largest request body accepted (spec B3). A real save is far below this. */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** What the handler needs from a file system; `slot` is always from `SLOTS`. */
export interface SaveFs {
  /** The file's text, or null when there is no file. */
  read(slot: Slot): Promise<string | null>;
  /** Stores the text, atomically (never a half-written file). */
  write(slot: Slot, text: string): Promise<void>;
  /** Removes the file; no error when there is none. */
  remove(slot: Slot): Promise<void>;
  /** The slots that currently have a file. */
  list(): Promise<Slot[]>;
}

export interface ApiRequest {
  method: string;
  /** The request target as sent: path and optional query. */
  url: string;
  /** The `Origin` header, if the browser sent one. */
  origin?: string;
  /** The `Host` header: the server's own authority. */
  host?: string;
  /** The body text, if any. */
  body?: string;
  /** The adapter stopped reading the body because it passed the cap. */
  bodyTooLarge?: boolean;
}

export interface ApiResponse {
  status: number;
  /** JSON-serialisable; absent for 204. */
  body?: unknown;
}

const json = (status: number, body?: unknown): ApiResponse => ({ status, body });
const error = (status: number, message: string): ApiResponse => json(status, { error: message });

function isSlot(text: string): text is Slot {
  return (SLOTS as readonly string[]).includes(text);
}

/**
 * Spec B4 (DNS rebinding): the plugin runs before Vite's own host check, so
 * the handler checks the `Host` header itself. Only this PC's own names are
 * served, on any port; a page on `attacker.example` that was rebound to
 * 127.0.0.1 still sends `Host: attacker.example` and gets 403, even with a
 * matching `Origin`. (Consequence: reaching the dev server by a LAN name or
 * address gets no API, which fits "this PC only".)
 */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function foreignHost(request: ApiRequest): boolean {
  return request.host === undefined || !LOCAL_HOST.test(request.host);
}

/**
 * Spec B4: a request with an `Origin` that isn't the server's own is another
 * website talking to localhost. Same origin and no `Origin` (curl, tools,
 * same-origin GET) are allowed.
 */
function foreignOrigin(request: ApiRequest): boolean {
  if (request.origin === undefined) return false;
  try {
    // Scheme, host and port: the server speaks http, so the origin must be http://<its own Host>.
    return new URL(request.origin).origin !== `http://${request.host}`;
  } catch {
    return true; // "null" or garbage
  }
}

/** The valid save stored for a slot, or null if empty or invalid (like the old `readSlot`). */
async function loadSave(slot: Slot, fs: SaveFs) {
  const text = await fs.read(slot);
  if (text === null) return null;
  const result = parseSavedGame(text);
  return 'save' in result ? result.save : null;
}

async function putSave(slot: Slot, request: ApiRequest, fs: SaveFs): Promise<ApiResponse> {
  if (request.bodyTooLarge || new TextEncoder().encode(request.body ?? '').length > MAX_BODY_BYTES) {
    return error(413, 'Save too large');
  }
  const result = parseSavedGame(request.body ?? '');
  if ('error' in result) return error(400, 'Not a valid save');
  await fs.write(slot, request.body ?? '');
  return json(204);
}

async function onSlot(slot: Slot, request: ApiRequest, fs: SaveFs): Promise<ApiResponse> {
  switch (request.method) {
    case 'GET': {
      const save = await loadSave(slot, fs);
      return save ? json(200, save) : error(404, 'Empty slot');
    }
    case 'PUT':
      return putSave(slot, request, fs);
    case 'DELETE':
      await fs.remove(slot);
      return json(204);
    default:
      return error(405, 'Method not allowed');
  }
}

async function listSaves(fs: SaveFs): Promise<ApiResponse> {
  const present = new Set(await fs.list());
  const saves: Record<string, unknown> = {};
  for (const slot of SLOTS) {
    if (!present.has(slot)) continue;
    const save = await loadSave(slot, fs);
    if (save) saves[slot] = save;
  }
  return json(200, saves);
}

/** Handles one request to `/api/...`. Never throws for a bad request; fs errors propagate. */
export async function handleSaveApi(request: ApiRequest, fs: SaveFs): Promise<ApiResponse> {
  if (foreignHost(request)) return error(403, 'Foreign host');
  if (foreignOrigin(request)) return error(403, 'Foreign origin');
  // The path is taken as sent, not decoded: "%2e%2e" is just not a slot.
  const path = request.url.split('?')[0]!;
  const get = request.method === 'GET';

  if (path === '/api/health') return get ? json(200, { ok: true }) : error(405, 'Method not allowed');
  if (path === '/api/saves') return get ? listSaves(fs) : error(405, 'Method not allowed');

  const prefix = '/api/saves/';
  const name = path.startsWith(prefix) ? path.slice(prefix.length) : null;
  // The slot allow-list: nothing but a member of SLOTS is ever passed to fs.
  if (name === null || !isSlot(name)) return error(404, 'Not found');
  return onSlot(name, request, fs);
}

/** An in-memory `SaveFs` for tests (and a record of every call made). */
export function memorySaveFs(initial: Partial<Record<Slot, string>> = {}): SaveFs & { files: Map<Slot, string>; calls: string[] } {
  const files = new Map<Slot, string>(Object.entries(initial) as [Slot, string][]);
  const calls: string[] = [];
  return {
    files,
    calls,
    async read(slot) {
      calls.push(`read ${slot}`);
      return files.get(slot) ?? null;
    },
    async write(slot, text) {
      calls.push(`write ${slot}`);
      files.set(slot, text);
    },
    async remove(slot) {
      calls.push(`remove ${slot}`);
      files.delete(slot);
    },
    async list() {
      calls.push('list');
      return [...files.keys()];
    },
  };
}
