import { describe, expect, it, vi } from 'vitest';
import { deploymentBand, autoDeploy } from './deployment';
import { buildFuzzGameState } from './fuzzHarness';
import { newSession, sessionApply, type SessionAction } from './gameSession';
import { HostDeployError, load, newGame, type Host, type HostConfig } from './host';
import { createSeededRng } from './rng';
import { SAVE_VERSION, buildSavedGame, parseSavedGame } from './saveGame';
import type { GameState, PlayerId } from './state';
import { createInitialState } from './turnManager';

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** An elephant, two foot and a ship each: small, but every kind of choice can come up. */
const ARMY = { elephants: 1, fantassins: 2, galeres: 1 };

const CONFIG: HostConfig = {
  players: [
    { name: 'Athènes', edge: 'W', army: ARMY },
    { name: 'Perse', edge: 'E', army: ARMY },
  ],
  options: { roundLimit: 3 },
};

interface Played {
  actions: SessionAction[];
  answered: number;
  state: GameState;
}

/** Plays `host` to gameOver, choosing uniformly from `legalActions()` on its own
 * seeded stream, with every input and output passed through JSON. */
function playOut(host: Host, chooserSeed: number): Played {
  const choose = createSeededRng(chooserSeed);
  const actions: SessionAction[] = [];
  let answered = 0;
  for (let i = 0; i < 20_000 && !host.state().gameOver; i++) {
    const legal = json(host.legalActions());
    const action = legal[Math.floor(choose() * legal.length)]!;
    if (host.question()) answered++;
    host.apply(json(action));
    actions.push(action);
  }
  expect(host.state().gameOver).toBe(true);
  return { actions, answered, state: host.state() };
}

/** The same game through the session API directly. */
function replayDirectly(state: GameState, rngSeed: number, actions: SessionAction[], deploy: boolean): GameState {
  const rng = createSeededRng(rngSeed);
  if (deploy) state.players.forEach((_, seat) => autoDeploy(state, seat, ARMY, rng));
  const session = newSession(state);
  for (const action of actions) sessionApply(session, action, rng);
  return state;
}

function directNewGame(): GameState {
  const players = CONFIG.players.map((p, i) => ({
    id: i as PlayerId,
    name: p.name,
    edge: p.edge,
    purchasePoints: 400,
    eliminated: false,
  }));
  return createInitialState(players, 'multi-defender', false, null, 3, true);
}

describe('a new game, through the host only (B13)', () => {
  const SEED = 11;

  it('plays from newGame to gameOver and ends where the session API does directly', () => {
    const played = playOut(newGame(CONFIG, SEED), 500);
    const direct = replayDirectly(directNewGame(), SEED, played.actions, true);
    expect(played.state).toEqual(json(direct));
  });

  it('is identical on a second run with the same seed', () => {
    const first = playOut(newGame(CONFIG, SEED), 500);
    const second = playOut(newGame(CONFIG, SEED), 500);
    expect(second.actions).toEqual(first.actions);
    expect(second.state).toEqual(first.state);
  });

  it('differs with another seed', () => {
    expect(newGame(CONFIG, SEED).state().units).not.toEqual(newGame(CONFIG, SEED + 1).state().units);
  });

  // Kills a missing rng pass-through anywhere on the host's path, the turn
  // order's reshuffle included (B14): `randomizedTurnOrder` is on here.
  it('never calls Math.random, shuffled turn order included', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random was called on the host path');
    });
    try {
      const config: HostConfig = { ...CONFIG, options: { roundLimit: 3, randomizedTurnOrder: true } };
      const played = playOut(newGame(config, SEED), 77);
      expect(played.actions.length).toBeGreaterThan(0);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('uses the seat order it is given', () => {
    const host = newGame({ ...CONFIG, seatOrder: [1, 0] }, SEED);
    expect(host.state().seatOrder).toEqual([1, 0]);
    expect(() => newGame({ ...CONFIG, seatOrder: [1, 1] }, SEED)).toThrow(/permutation/);
  });

  it('needs a finite integer seed', () => {
    for (const seed of [1.5, Number.NaN, Number.POSITIVE_INFINITY, undefined as unknown as number]) {
      expect(() => newGame(CONFIG, seed)).toThrow(/seed/);
    }
  });
});

describe('a loaded game, through the host only (B13)', () => {
  /** buildFuzzGameState's armies are adjacent from the first phase, so combat comes quickly. */
  function savedFuzzGame(): string {
    const state = buildFuzzGameState();
    state.roundLimit = 3;
    return JSON.stringify(
      buildSavedGame({
        savedAt: '2026-01-01T00:00:00.000Z',
        playerCount: 2,
        playerNames: ['P0', 'P1'],
        edges: ['W', 'E'],
        armySelections: [{}, {}],
        combatMode: state.combatMode,
        seatControls: ['human', 'human'],
        testMode: false,
        gameState: state,
        attackedThisPhase: [],
        rammedThisTurn: [],
      }),
    );
  }

  it('answers questions through apply and ends where the session API does directly', () => {
    let answered = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const played = playOut(load(savedFuzzGame(), seed), 900 + seed);
      answered += played.answered;
      const start = (parseSavedGame(savedFuzzGame()) as { save: { gameState: GameState } }).save.gameState;
      const direct = replayDirectly(start, seed, played.actions, false);
      expect(played.state, `seed ${seed}`).toEqual(json(direct));
    }
    expect(answered).toBeGreaterThan(0);
  });

  it('refuses a file that is not a save', () => {
    expect(() => load('{"nope":true}', 1)).toThrow(/notASave/);
    expect(() => load('not json', 1)).toThrow(/invalidJson/);
  });
});

describe('save()', () => {
  it('refuses while a question is open, and otherwise gives a loadable SavedGame', () => {
    // A game that has reached a question, found by playing a seeded chooser.
    const host = load(
      JSON.stringify(
        buildSavedGame({
          savedAt: 'x',
          playerCount: 2,
          playerNames: ['P0', 'P1'],
          edges: ['W', 'E'],
          armySelections: [{}, {}],
          combatMode: 'multi-defender',
          seatControls: ['human', 'ai-ev'],
          testMode: false,
          gameState: (() => {
            const s = buildFuzzGameState();
            s.roundLimit = 3;
            return s;
          })(),
          attackedThisPhase: [],
          rammedThisTurn: [],
        }),
      ),
      3,
    );

    const saved = host.save(); // no question open yet
    expect(saved.version).toBe(SAVE_VERSION);
    expect(parseSavedGame(JSON.stringify(saved))).toHaveProperty('save');
    expect(saved.seatControls).toEqual(['human', 'ai-ev']);
    const back = load(JSON.stringify(saved), 3);
    expect(back.state()).toEqual(host.state());
    expect(back.save().attackedThisPhase).toEqual(saved.attackedThisPhase);

    const choose = createSeededRng(41);
    let refused = false;
    for (let i = 0; i < 20_000 && !host.state().gameOver && !refused; i++) {
      if (host.question()) {
        expect(() => host.save()).toThrow(/question is open/);
        refused = true;
        break;
      }
      const legal = host.legalActions();
      host.apply(legal[Math.floor(choose() * legal.length)]!);
    }
    expect(refused, 'the chooser reached a question').toBe(true);
  });

  it('carries the setup and the context into the save, and loads back equal', () => {
    const host = newGame({ ...CONFIG, seatControls: ['human', 'ai-greedy'] }, 4);
    const saved = host.save();
    expect(saved.playerNames).toEqual(['Athènes', 'Perse']);
    expect(saved.edges).toEqual(['W', 'E']);
    expect(saved.armySelections).toEqual([ARMY, ARMY]);
    expect(saved.seatControls).toEqual(['human', 'ai-greedy']);
    expect(load(saved, 4).state()).toEqual(host.state());
  });
});

describe('placements in the config', () => {
  const band = deploymentBand('W');

  it('deploys explicit placements, checked by deployUnit', () => {
    const config: HostConfig = {
      players: [
        { name: 'A', edge: 'W', army: {}, placements: [{ typeId: 'archers', hex: band[0]! }] },
        { name: 'B', edge: 'E', army: ARMY },
      ],
    };
    const state = newGame(config, 2).state();
    expect(state.units.filter((u) => u.owner === 0).map((u) => [u.id, u.typeId, u.position])).toEqual([
      ['p0u0', 'archers', band[0]],
    ]);
    expect(state.units.filter((u) => u.owner === 1).length).toBeGreaterThan(0);
  });

  it('throws the refusal as data on an illegal hex', () => {
    const config: HostConfig = {
      players: [
        { name: 'A', edge: 'W', army: {}, placements: [{ typeId: 'archers', hex: deploymentBand('E')[0]! }] }, // the other edge's band
        { name: 'B', edge: 'E', army: {} },
      ],
    };
    let thrown: unknown;
    try {
      newGame(config, 2);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(HostDeployError);
    expect((thrown as HostDeployError).deployError).toEqual({ kind: 'illegalHex', hex: deploymentBand('E')[0] });
    expect((thrown as HostDeployError).seat).toBe(0);
  });
});

describe('load restores the context (H4)', () => {
  const SEA = { q: 28, r: 6 };
  const piece = (id: string, owner: 0 | 1, typeId: string, q: number, r: number, movementLeft = 0) => ({
    id, owner, typeId, position: { q, r }, movementLeft, facing: 0, defendedThisPhase: false, charged: false, destroyed: false,
  });

  /** Movement phase: a ship ready to ram, a land attacker next to a defender. */
  function savedAtStart(): string {
    const state = buildFuzzGameState();
    state.units = [
      piece('ship', 0, 'galeres', SEA.q, SEA.r, 8),
      piece('foe', 1, 'quintiremes', SEA.q + 1, SEA.r),
      piece('att', 0, 'phalanges', 11, 5),
      piece('def', 1, 'archers', 10, 5),
    ];
    state.roundLimit = null;
    return JSON.stringify(
      buildSavedGame({
        savedAt: 'x', playerCount: 2, playerNames: ['P0', 'P1'], edges: ['W', 'E'], armySelections: [{}, {}],
        combatMode: 'multi-defender', seatControls: ['human', 'human'], testMode: false,
        gameState: state, attackedThisPhase: [], rammedThisTurn: [],
      }),
    );
  }

  /** Rams, ends the phase, attacks and settles; null when the dice sank something. */
  function played(seed: number): Host | null {
    const host = load(savedAtStart(), seed);
    host.apply({ kind: 'ram', unitId: 'ship' });
    host.apply({ kind: 'endPhase' });
    host.apply({ kind: 'landAttack', attackerIds: ['att'], defenderIds: ['def'] });
    while (host.question()) host.apply(host.legalActions()[0]!);
    const alive = (id: string) => !host.state().units.find((u) => u.id === id)!.destroyed;
    return alive('att') && alive('ship') && alive('foe') ? host : null;
  }

  it('brings back the attacked and rammed lists, so nobody acts twice', () => {
    let host: Host | null = null;
    for (let seed = 1; seed <= 60 && !host; seed++) host = played(seed);
    expect(host, 'a seed leaves the attacker and both ships alive').not.toBeNull();
    const saved = host!.save();
    expect(saved.attackedThisPhase).toEqual(['att']);
    expect(saved.rammedThisTurn).toEqual(['ship']);

    const back = load(JSON.stringify(saved), 9);
    expect(back.save().attackedThisPhase).toEqual(['att']);
    expect(back.save().rammedThisTurn).toEqual(['ship']);
    const legal = back.legalActions();
    expect(legal.some((a) => a.kind === 'landAttack' && a.attackerIds.includes('att'))).toBe(false);
    expect(legal.some((a) => a.kind === 'board' && a.attackerId === 'ship')).toBe(false);
  });
});
