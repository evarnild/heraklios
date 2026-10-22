import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { emptySelection } from '../src/engine/army';
import { buildSavedGame } from '../src/engine/saveGame';
import type { Player, PlayerId } from '../src/engine/state';
import { createInitialState } from '../src/engine/turnManager';
import { MAX_BODY_BYTES, memorySaveFs, type SaveFs } from './saveApi';
import { readBody, saveApiMiddleware, saveApiPlugin } from './saveApiPlugin';

function sampleText(): string {
  const players: Player[] = [
    { id: 0 as PlayerId, name: 'A', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1 as PlayerId, name: 'B', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  return JSON.stringify(
    buildSavedGame({
      savedAt: '2026-07-25T12:34:56.000Z',
      playerCount: 2,
      playerNames: ['A', 'B'],
      edges: ['W', 'E'],
      armySelections: [emptySelection(), emptySelection()],
      combatMode: 'multi-defender',
      seatControls: ['human', 'human'],
      testMode: false,
      gameState: createInitialState(players, 'multi-defender'),
      attackedThisPhase: [],
      rammedThisTurn: [],
    }),
  );
}

/** A fake IncomingMessage: a Readable with a method, url and headers. */
function fakeRequest(method: string, url: string, headers: Record<string, string>, chunks: (string | Buffer)[] = []): IncomingMessage {
  return Object.assign(Readable.from(chunks, { objectMode: false }), { method, url, headers }) as unknown as IncomingMessage;
}

interface Sent {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Runs the middleware once; resolves with what it sent, or with 'next' if it passed the request on. */
function run(fs: SaveFs, request: IncomingMessage): Promise<Sent | 'next'> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    const response = {
      statusCode: 0,
      setHeader: (k: string, v: string) => void (headers[k.toLowerCase()] = v),
      end: (body?: string) => resolve({ status: response.statusCode, headers, body: body ?? '' }),
    } as unknown as ServerResponse;
    saveApiMiddleware(() => fs)(request, response, () => resolve('next'));
  });
}

const local = { host: '127.0.0.1:5173' };

describe('saveApiMiddleware', () => {
  it('passes anything outside /api/ on', async () => {
    expect(await run(memorySaveFs(), fakeRequest('GET', '/index.html', local))).toBe('next');
    expect(await run(memorySaveFs(), fakeRequest('GET', '/apix', local))).toBe('next');
  });

  it('answers with JSON and Cache-Control: no-store', async () => {
    const res = (await run(memorySaveFs(), fakeRequest('GET', '/api/health', local))) as Sent;
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-type']).toBe('application/json');
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('sets no-store on a 204 too', async () => {
    const res = (await run(memorySaveFs(), fakeRequest('DELETE', '/api/saves/1', local))) as Sent;
    expect(res.status).toBe(204);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('forwards the Origin header: a foreign one is 403', async () => {
    const fs = memorySaveFs();
    const res = (await run(fs, fakeRequest('GET', '/api/saves', { ...local, origin: 'http://evil.example' }))) as Sent;
    expect(res.status).toBe(403);
    expect(fs.calls).toEqual([]);
  });

  it('forwards the Host header: a foreign one is 403', async () => {
    const fs = memorySaveFs();
    const res = (await run(fs, fakeRequest('GET', '/api/saves', { host: 'attacker.example:5173' }))) as Sent;
    expect(res.status).toBe(403);
    expect(fs.calls).toEqual([]);
  });

  it('stores a valid PUT body', async () => {
    const fs = memorySaveFs();
    const body = sampleText();
    const res = (await run(fs, fakeRequest('PUT', '/api/saves/3', local, [body]))) as Sent;
    expect(res.status).toBe(204);
    expect(fs.files.get('3')).toBe(body);
  });

  it('answers 413 for a body over the cap and writes nothing', async () => {
    const fs = memorySaveFs();
    const chunks = Array.from({ length: 5 }, () => Buffer.alloc(MAX_BODY_BYTES / 2, 0x20));
    const res = (await run(fs, fakeRequest('PUT', '/api/saves/1', local, chunks))) as Sent;
    expect(res.status).toBe(413);
    expect(fs.calls).toEqual([]);
  });

  it('answers 500 when the file system fails', async () => {
    const fs: SaveFs = { ...memorySaveFs(), list: () => Promise.reject(new Error('disk')) };
    const res = (await run(fs, fakeRequest('GET', '/api/saves', local))) as Sent;
    expect(res.status).toBe(500);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('readBody', () => {
  it('returns the body when it fits', async () => {
    expect(await readBody(fakeRequest('PUT', '/', {}, ['ab', 'cd']))).toEqual({ body: 'abcd', tooLarge: false });
  });

  it('stops buffering past the cap and reports it', async () => {
    const chunks = Array.from({ length: 8 }, () => Buffer.alloc(MAX_BODY_BYTES / 2, 0x61));
    const res = await readBody(fakeRequest('PUT', '/', {}, chunks));
    expect(res.tooLarge).toBe(true);
    expect(res.body).toBe(''); // what was buffered was dropped, not kept
  });

  it('accepts a body of exactly the cap', async () => {
    const res = await readBody(fakeRequest('PUT', '/', {}, [Buffer.alloc(MAX_BODY_BYTES, 0x61)]));
    expect(res.tooLarge).toBe(false);
    expect(res.body.length).toBe(MAX_BODY_BYTES);
  });
});

describe('saveApiPlugin', () => {
  it('registers the middleware on the dev server AND the preview server', () => {
    const plugin = saveApiPlugin() as unknown as {
      configResolved: (c: { root: string }) => void;
      configureServer: (s: unknown) => void;
      configurePreviewServer: (s: unknown) => void;
    };
    plugin.configResolved({ root: '/nowhere' });
    const dev = { middlewares: { use: vi.fn() } };
    const preview = { middlewares: { use: vi.fn() } };
    plugin.configureServer(dev);
    plugin.configurePreviewServer(preview);
    expect(dev.middlewares.use).toHaveBeenCalledTimes(1);
    expect(preview.middlewares.use).toHaveBeenCalledTimes(1);
  });
});
