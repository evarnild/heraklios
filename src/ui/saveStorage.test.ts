// AC2 (intents/45-save-api): the file-store client and the read-only import
// of browser saves, against a stubbed `fetch` and a stubbed `localStorage`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySelection } from '../engine/army';
import { buildSavedGame, type SavedGame } from '../engine/saveGame';
import type { Player, PlayerId } from '../engine/state';
import { createInitialState } from '../engine/turnManager';
import {
  browserSaves,
  clearSave,
  copyBrowserSaves,
  hasCopyableBrowserSaves,
  readAllSaves,
  readSave,
  writeSave,
  type SlotId,
} from './saveStorage';

function sample(turn = 3): SavedGame {
  const players: Player[] = [
    { id: 0 as PlayerId, name: 'Athènes', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1 as PlayerId, name: 'Perse', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const gameState = createInitialState(players, 'multi-defender');
  gameState.turnNumber = turn;
  return buildSavedGame({
    savedAt: '2026-07-25T12:34:56.000Z',
    playerCount: 2,
    playerNames: ['Athènes', 'Perse'],
    edges: ['W', 'E'],
    armySelections: [emptySelection(), emptySelection()],
    combatMode: 'multi-defender',
    seatControls: ['human', 'human'],
    testMode: false,
    gameState,
    attackedThisPhase: [],
    rammedThisTurn: [],
  });
}

interface Call {
  method: string;
  path: string;
  body?: string;
}

/** A fake server: a map of slot -> save, behind a stubbed `fetch`. */
function fakeServer(initial: Record<string, SavedGame> = {}, mode: 'up' | 'down' | 'broken' = 'up') {
  const files = new Map<string, SavedGame>(Object.entries(initial));
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, path, body: init?.body as string | undefined });
    if (mode === 'down') throw new TypeError('fetch failed');
    if (mode === 'broken') return new Response('oops', { status: 500 });
    if (path === '/api/saves') return Response.json(Object.fromEntries(files));
    const slot = path.replace('/api/saves/', '');
    if (method === 'PUT') {
      files.set(slot, JSON.parse(init!.body as string) as SavedGame);
      return new Response(null, { status: 204 });
    }
    if (method === 'DELETE') {
      files.delete(slot);
      return new Response(null, { status: 204 });
    }
    const save = files.get(slot);
    return save ? Response.json(save) : new Response('{}', { status: 404 });
  });
  return { files, calls };
}

/** A `localStorage` that records any write or removal. */
function fakeBrowser(items: Record<string, string>) {
  const setItem = vi.fn();
  const removeItem = vi.fn();
  return { getItem: (key: string) => items[key] ?? null, setItem, removeItem, clear: vi.fn() };
}

afterEach(() => vi.unstubAllGlobals());

describe('the file-store client', () => {
  it('maps each call to its route', async () => {
    const { calls } = fakeServer({ '2': sample() });
    await readSave(2);
    await readSave('autosave');
    await readAllSaves();
    await writeSave(3, sample(4));
    await clearSave(3);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /api/saves/2',
      'GET /api/saves/autosave',
      'GET /api/saves',
      'PUT /api/saves/3',
      'DELETE /api/saves/3',
    ]);
    expect(JSON.parse(calls[3]!.body!)).toEqual(sample(4));
  });

  it('reads a stored save back, and an empty slot as a successful null', async () => {
    fakeServer({ '1': sample(9) });
    const hit = await readSave(1);
    expect(hit.ok && hit.value?.gameState.turnNumber).toBe(9);
    expect(await readSave(2)).toEqual({ ok: true, value: null });
  });

  it('tells an invalid file (empty slot) from a server that is down', async () => {
    vi.stubGlobal('fetch', async () => new Response('this is not a save', { status: 200 }));
    expect(await readSave(1)).toEqual({ ok: true, value: null });
    fakeServer({}, 'down');
    expect(await readSave(1)).toEqual({ ok: false });
  });

  it('lists the valid saves by slot, ignoring junk entries', async () => {
    fakeServer({ '1': sample(), autosave: sample(5), '3': { nonsense: true } as unknown as SavedGame });
    const all = await readAllSaves();
    expect(all.ok && [...all.value.keys()]).toEqual(['autosave', 1]);
  });

  it('write and clear report success', async () => {
    const { files } = fakeServer();
    expect(await writeSave(1, sample())).toBe(true);
    expect(files.has('1')).toBe(true);
    expect(await clearSave(1)).toBe(true);
    expect(files.has('1')).toBe(false);
  });

  it.each(['down', 'broken'] as const)('a server that is %s gives not-ok / false', async (mode) => {
    fakeServer({}, mode);
    expect(await readSave(1)).toEqual({ ok: false });
    expect(await readAllSaves()).toEqual({ ok: false });
    expect(await writeSave(1, sample())).toBe(false);
    expect(await clearSave(1)).toBe(false);
  });
});

describe('browserSaves', () => {
  it('reads valid saves from the old keys and leaves invalid ones out', () => {
    const browser = fakeBrowser({
      'heraklios.save.slot2': JSON.stringify(sample(2)),
      'heraklios.save.autosave': JSON.stringify(sample(7)),
      'heraklios.save.slot4': 'garbage',
    });
    expect([...browserSaves(browser).keys()]).toEqual(['autosave', 2]);
  });

  it('is empty when storage is unavailable', () => {
    expect(browserSaves(null).size).toBe(0);
  });
});

describe('copyBrowserSaves', () => {
  const key = (n: SlotId) => (n === 'autosave' ? 'heraklios.save.autosave' : `heraklios.save.slot${n}`);

  it('copies into empty slots only, never overwriting a taken one', async () => {
    const { files, calls } = fakeServer({ '2': sample(20) });
    const browser = fakeBrowser({ [key(1)]: JSON.stringify(sample(1)), [key(2)]: JSON.stringify(sample(2)) });
    expect(await copyBrowserSaves(browser)).toEqual({ copied: 1, skipped: 1, stopped: false });
    expect(files.get('1')?.gameState.turnNumber).toBe(1);
    expect(files.get('2')?.gameState.turnNumber).toBe(20);
    expect(calls.filter((c) => c.method === 'PUT').map((c) => c.path)).toEqual(['/api/saves/1']);
  });

  it('skips invalid browser saves and counts them', async () => {
    const { files } = fakeServer();
    const browser = fakeBrowser({ [key(3)]: '{broken', [key('autosave')]: JSON.stringify(sample(6)) });
    expect(await copyBrowserSaves(browser)).toEqual({ copied: 1, skipped: 1, stopped: false });
    expect([...files.keys()]).toEqual(['autosave']);
  });

  it('never writes or removes anything in the browser', async () => {
    fakeServer();
    const browser = fakeBrowser({ [key(1)]: JSON.stringify(sample()), [key(2)]: 'garbage' });
    await copyBrowserSaves(browser);
    expect(browser.setItem).not.toHaveBeenCalled();
    expect(browser.removeItem).not.toHaveBeenCalled();
    expect(browser.clear).not.toHaveBeenCalled();
  });

  it('is null when the server does not answer, and copies nothing', async () => {
    const { calls } = fakeServer({}, 'down');
    expect(await copyBrowserSaves(fakeBrowser({ [key(1)]: JSON.stringify(sample()) }))).toBeNull();
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('reports what was copied when the server stops answering partway', async () => {
    const files = new Map<string, SavedGame>();
    let puts = 0;
    vi.stubGlobal('fetch', async (path: string, init?: RequestInit) => {
      if (path === '/api/saves') return Response.json({});
      if (init?.method === 'PUT') {
        if (++puts > 1) throw new TypeError('fetch failed');
        files.set(path, JSON.parse(init.body as string) as SavedGame);
        return new Response(null, { status: 204 });
      }
      return new Response('{}', { status: 404 });
    });
    const browser = fakeBrowser({ [key(1)]: JSON.stringify(sample(1)), [key(2)]: JSON.stringify(sample(2)), [key(3)]: JSON.stringify(sample(3)) });
    expect(await copyBrowserSaves(browser)).toEqual({ copied: 1, skipped: 0, stopped: true });
    expect([...files.keys()]).toEqual(['/api/saves/1']);
  });

  it('copies nothing from an empty browser', async () => {
    const { calls } = fakeServer();
    expect(await copyBrowserSaves(fakeBrowser({}))).toEqual({ copied: 0, skipped: 0, stopped: false });
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
  });
});

describe('hasCopyableBrowserSaves (the offer)', () => {
  const browser = () => fakeBrowser({ 'heraklios.save.slot1': JSON.stringify(sample()), 'heraklios.save.slot2': 'garbage' });

  it('shows while a valid browser save has no file yet', () => {
    expect(hasCopyableBrowserSaves(new Map(), browser())).toBe(true);
  });

  it('goes away once the file slot is taken', () => {
    expect(hasCopyableBrowserSaves(new Map([[1, sample()]]), browser())).toBe(false);
  });

  it('is not shown for invalid browser saves alone, or an empty browser', () => {
    expect(hasCopyableBrowserSaves(new Map(), fakeBrowser({ 'heraklios.save.slot2': 'garbage' }))).toBe(false);
    expect(hasCopyableBrowserSaves(new Map(), fakeBrowser({}))).toBe(false);
    expect(hasCopyableBrowserSaves(new Map(), null)).toBe(false);
  });

  it('after a copy, a refreshed list no longer offers it', async () => {
    fakeServer();
    const b = browser();
    await copyBrowserSaves(b);
    const files = await readAllSaves();
    expect(files.ok && hasCopyableBrowserSaves(files.value, b)).toBe(false);
  });
});
