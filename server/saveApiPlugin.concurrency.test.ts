// The plugin must build ONE file store for all requests (and for the dev and preview
// servers of one process): the per-slot write queue lives in that instance. With a
// store per request the queue is empty every time and concurrent saves race.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptySelection } from '../src/engine/army';
import { buildSavedGame } from '../src/engine/saveGame';
import type { Player, PlayerId } from '../src/engine/state';
import { createInitialState } from '../src/engine/turnManager';
import { saveApiPlugin } from './saveApiPlugin';

const renames = vi.hoisted(() => ({ inFlight: new Map<string, number>(), maxInFlight: 0 }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...real,
    rename: async (from: string, to: string) => {
      const n = (renames.inFlight.get(to) ?? 0) + 1;
      renames.inFlight.set(to, n);
      renames.maxInFlight = Math.max(renames.maxInFlight, n);
      try {
        await new Promise((r) => setTimeout(r, 5));
        return await real.rename(from, to);
      } finally {
        renames.inFlight.set(to, (renames.inFlight.get(to) ?? 1) - 1);
      }
    },
  };
});

function saveText(turn: number): string {
  const players: Player[] = [
    { id: 0 as PlayerId, name: 'A', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1 as PlayerId, name: 'B', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const gameState = createInitialState(players, 'multi-defender');
  gameState.turnNumber = turn;
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
      gameState,
      attackedThisPhase: [],
      rammedThisTurn: [],
    }),
  );
}

type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

function put(handler: Handler, slot: string, body: string): Promise<number> {
  const request = Object.assign(Readable.from([Buffer.from(body)]), {
    method: 'PUT',
    url: `/api/saves/${slot}`,
    headers: { host: '127.0.0.1:5173' },
  }) as unknown as IncomingMessage;
  return new Promise((resolve) => {
    const response = { statusCode: 0, setHeader: () => undefined, end: () => resolve(response.statusCode) } as unknown as ServerResponse;
    handler(request, response, () => resolve(-1));
  });
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'h45-plugin-'));
  vi.stubEnv('HERAKLIOS_SAVES_DIR', dir);
  renames.inFlight.clear();
  renames.maxInFlight = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe('the plugin shares one file store', () => {
  it('concurrent PUTs, on both servers, never overlap their renames, all succeed, and the last issued wins', async () => {
    const plugin = saveApiPlugin() as unknown as {
      configResolved: (c: { root: string }) => void;
      configureServer: (s: unknown) => void;
      configurePreviewServer: (s: unknown) => void;
    };
    plugin.configResolved({ root: '/unused' });
    const handlers: Handler[] = [];
    const server = { middlewares: { use: (h: Handler) => handlers.push(h) } };
    plugin.configureServer(server);
    plugin.configurePreviewServer(server);

    const statuses = await Promise.all(Array.from({ length: 12 }, (_, i) => put(handlers[i % 2]!, 'autosave', saveText(100 + i))));
    expect(statuses).toEqual(Array.from({ length: 12 }, () => 204));
    expect(renames.maxInFlight).toBe(1);
    expect(JSON.parse(readFileSync(join(dir, 'autosave.json'), 'utf8')).gameState.turnNumber).toBe(111);
    expect(readdirSync(dir)).toEqual(['autosave.json']);
  });
});
