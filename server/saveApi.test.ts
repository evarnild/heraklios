import { describe, expect, it } from 'vitest';
import { emptySelection } from '../src/engine/army';
import { buildSavedGame } from '../src/engine/saveGame';
import type { Player, PlayerId } from '../src/engine/state';
import { createInitialState } from '../src/engine/turnManager';
import { MAX_BODY_BYTES, handleSaveApi, memorySaveFs, type ApiRequest } from './saveApi';

const HOST = '127.0.0.1:5173';

function sampleText(turn = 3): string {
  const players: Player[] = [
    { id: 0 as PlayerId, name: 'Athènes', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1 as PlayerId, name: 'Perse', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const gameState = createInitialState(players, 'multi-defender');
  gameState.turnNumber = turn;
  return JSON.stringify(
    buildSavedGame({
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
    }),
  );
}

const req = (method: string, url: string, extra: Partial<ApiRequest> = {}): ApiRequest => ({ method, url, host: HOST, ...extra });

describe('GET /api/health', () => {
  it('answers ok', async () => {
    expect(await handleSaveApi(req('GET', '/api/health'), memorySaveFs())).toEqual({ status: 200, body: { ok: true } });
  });
});

describe('GET /api/saves', () => {
  it('lists every valid save by slot and leaves out invalid files', async () => {
    const fs = memorySaveFs({ '2': sampleText(2), autosave: sampleText(5), '4': '{not json', '6': '{"version":3}' });
    const res = await handleSaveApi(req('GET', '/api/saves'), fs);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body as object).sort()).toEqual(['2', 'autosave']);
  });

  it('is an empty object when nothing is saved', async () => {
    expect(await handleSaveApi(req('GET', '/api/saves'), memorySaveFs())).toEqual({ status: 200, body: {} });
  });

  it('refuses other methods', async () => {
    expect((await handleSaveApi(req('DELETE', '/api/saves'), memorySaveFs())).status).toBe(405);
  });
});

describe('GET /api/saves/:slot', () => {
  it('returns the save', async () => {
    const fs = memorySaveFs({ '1': sampleText(7) });
    const res = await handleSaveApi(req('GET', '/api/saves/1'), fs);
    expect(res.status).toBe(200);
    expect((res.body as { gameState: { turnNumber: number } }).gameState.turnNumber).toBe(7);
  });

  it('is 404 when empty or invalid', async () => {
    const fs = memorySaveFs({ '3': 'garbage' });
    expect((await handleSaveApi(req('GET', '/api/saves/2'), fs)).status).toBe(404);
    expect((await handleSaveApi(req('GET', '/api/saves/3'), fs)).status).toBe(404);
  });

  it('ignores a query string', async () => {
    const fs = memorySaveFs({ autosave: sampleText() });
    expect((await handleSaveApi(req('GET', '/api/saves/autosave?x=1'), fs)).status).toBe(200);
  });
});

describe('PUT /api/saves/:slot', () => {
  it('stores a valid save as sent and answers 204', async () => {
    const fs = memorySaveFs();
    const body = sampleText();
    expect(await handleSaveApi(req('PUT', '/api/saves/5', { body }), fs)).toEqual({ status: 204, body: undefined });
    expect(fs.files.get('5')).toBe(body);
  });

  it('accepts the autosave slot', async () => {
    const fs = memorySaveFs();
    expect((await handleSaveApi(req('PUT', '/api/saves/autosave', { body: sampleText() }), fs)).status).toBe(204);
    expect(fs.files.has('autosave')).toBe(true);
  });

  it.each([['not json'], ['{}'], ['{"version":999}'], ['']])('answers 400 and writes nothing for %j', async (body) => {
    const fs = memorySaveFs({ '1': sampleText(1) });
    const res = await handleSaveApi(req('PUT', '/api/saves/1', { body }), fs);
    expect(res.status).toBe(400);
    expect(fs.calls.filter((c) => c.startsWith('write'))).toEqual([]);
    expect(fs.files.get('1')).toBe(sampleText(1));
  });

  it('answers 413 above 2 MB without writing', async () => {
    const fs = memorySaveFs();
    const big = sampleText() + ' '.repeat(MAX_BODY_BYTES);
    expect((await handleSaveApi(req('PUT', '/api/saves/1', { body: big }), fs)).status).toBe(413);
    expect((await handleSaveApi(req('PUT', '/api/saves/1', { bodyTooLarge: true }), fs)).status).toBe(413);
    expect(fs.calls).toEqual([]);
  });
});

describe('DELETE /api/saves/:slot', () => {
  it('removes the file and answers 204', async () => {
    const fs = memorySaveFs({ '6': sampleText() });
    expect((await handleSaveApi(req('DELETE', '/api/saves/6'), fs)).status).toBe(204);
    expect(fs.files.has('6')).toBe(false);
  });

  it('answers 204 for an empty slot too', async () => {
    expect((await handleSaveApi(req('DELETE', '/api/saves/6'), memorySaveFs())).status).toBe(204);
  });
});

describe('the slot allow-list', () => {
  it.each(['0', '7', '10', '../x', '..', 'autosave.json', '%2e%2e', '%31', '1/', '1/2', 'slot-1', '', 'AUTOSAVE', '..%2fx', '..\\x'])(
    'a slot of %j is 404 and never reaches the file system',
    async (slot) => {
      for (const method of ['GET', 'PUT', 'DELETE']) {
        const fs = memorySaveFs();
        const res = await handleSaveApi(req(method, `/api/saves/${slot}`, { body: sampleText() }), fs);
        expect(res.status, `${method} ${slot}`).toBe(404);
        expect(fs.calls, `${method} ${slot}`).toEqual([]);
      }
    },
  );

  it('an unknown path is 404', async () => {
    expect((await handleSaveApi(req('GET', '/api/other'), memorySaveFs())).status).toBe(404);
  });

  it('another method on a slot is 405', async () => {
    const fs = memorySaveFs();
    expect((await handleSaveApi(req('POST', '/api/saves/1'), fs)).status).toBe(405);
    expect(fs.calls).toEqual([]);
  });
});

describe('the origin check', () => {
  it('refuses a foreign origin on every route, touching nothing', async () => {
    const routes = [
      ['GET', '/api/health'],
      ['GET', '/api/saves'],
      ['GET', '/api/saves/1'],
      ['PUT', '/api/saves/1'],
      ['DELETE', '/api/saves/1'],
    ] as const;
    for (const [method, url] of routes) {
      const fs = memorySaveFs({ '1': sampleText() });
      const res = await handleSaveApi(req(method, url, { origin: 'http://evil.example', body: sampleText() }), fs);
      expect(res.status, `${method} ${url}`).toBe(403);
      expect(fs.calls).toEqual([]);
    }
  });

  it('refuses the same host on another port, and "null"', async () => {
    const fs = memorySaveFs();
    expect((await handleSaveApi(req('GET', '/api/saves', { origin: 'http://127.0.0.1:9999' }), fs)).status).toBe(403);
    expect((await handleSaveApi(req('GET', '/api/saves', { origin: 'null' }), fs)).status).toBe(403);
  });

  it("allows the server's own origin and no origin", async () => {
    const fs = memorySaveFs();
    expect((await handleSaveApi(req('GET', '/api/saves', { origin: `http://${HOST}` }), fs)).status).toBe(200);
    expect((await handleSaveApi(req('GET', '/api/saves'), fs)).status).toBe(200);
  });
});
