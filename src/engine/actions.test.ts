import { describe, it, expect } from 'vitest';
import { legalActions, applyAction, type Action } from './actions';
import { reachableHexes } from './movement';
import { createInitialState } from './turnManager';
import { DIRECTIONS } from './hex';
import type { GameState, Player, Unit } from './state';

// (10,3) through (19,3) are all confirmed 'plain' hexes on the shipped map
// (see engine/movement.test.ts's comment, which relies on the same row).
const LAND_ROW_START = { q: 10, r: 3 };
// (28,6) has every hex within 3 hexes as open sea on the shipped map (see
// engine/navalMovement.test.ts's comment).
const SEA_CENTER = { q: 28, r: 6 };

function makeUnit(overrides: Partial<Unit> & { typeId: string; position: { q: number; r: number } }): Unit {
  return {
    id: overrides.id ?? `test-${Math.random()}`,
    owner: 0,
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
    ...overrides,
  };
}

function makeState(units: Unit[], phase: 'movement' | 'combat' = 'movement'): GameState {
  const players: Player[] = [
    { id: 0, name: 'P0', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1, name: 'P1', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const state = createInitialState(players, 'multi-defender');
  state.units = units;
  state.phase = phase;
  return state;
}

function fixedRng(value: number): () => number {
  return () => value;
}

describe('legalActions', () => {
  it('always includes endPhase', () => {
    const state = makeState([]);
    expect(legalActions(state, {})).toContainEqual({ kind: 'endPhase' });
  });

  it('movement phase: enumerates exactly one landMove per hex reachableHexes reports for a land unit', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: LAND_ROW_START, movementLeft: 3 });
    const state = makeState([unit]);
    const actions = legalActions(state, {});
    const moves = actions.filter((a) => a.kind === 'landMove');
    const expectedHexKeys = new Set(reachableHexes(state, unit).keys());
    expect(moves).toHaveLength(expectedHexKeys.size);
    for (const move of moves) {
      if (move.kind !== 'landMove') continue;
      expect(expectedHexKeys.has(`${move.to.q},${move.to.r}`)).toBe(true);
    }
    expect(moves).toContainEqual({ kind: 'landMove', unitId: unit.id, to: { q: 11, r: 3 } });
    expect(moves).toContainEqual({ kind: 'landMove', unitId: unit.id, to: { q: 13, r: 3 } });
  });

  it('movement phase: ignores units belonging to the other player', () => {
    const own = makeUnit({ typeId: 'fantassins', position: LAND_ROW_START, movementLeft: 3, owner: 0 });
    const enemy = makeUnit({ typeId: 'fantassins', position: { q: 14, r: 3 }, movementLeft: 3, owner: 1 });
    const state = makeState([own, enemy]);
    const actions = legalActions(state, {});
    expect(actions.some((a) => a.kind === 'landMove' && a.unitId === enemy.id)).toBe(false);
  });

  it('movement phase: ignores destroyed units', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: LAND_ROW_START, movementLeft: 3, destroyed: true });
    const state = makeState([unit]);
    expect(legalActions(state, {}).filter((a) => a.kind === 'landMove')).toHaveLength(0);
  });

  it('movement phase: a naval unit gets navalMove, both navalRotate directions, but no ram without a contact', () => {
    const ship = makeUnit({ typeId: 'biremes', position: SEA_CENTER, facing: 0, movementLeft: 3 });
    const state = makeState([ship]);
    const actions = legalActions(state, {});
    expect(actions.some((a) => a.kind === 'navalMove')).toBe(true);
    expect(actions).toContainEqual({ kind: 'navalRotate', unitId: ship.id, direction: 1 });
    expect(actions).toContainEqual({ kind: 'navalRotate', unitId: ship.id, direction: -1 });
    expect(actions.some((a) => a.kind === 'ram')).toBe(false);
  });

  it('movement phase: offers a ram action when already bow-on to an adjacent enemy ship', () => {
    const forward = { q: SEA_CENTER.q + DIRECTIONS[0]!.q, r: SEA_CENTER.r + DIRECTIONS[0]!.r };
    const ship = makeUnit({ id: 'a', typeId: 'galeres', position: SEA_CENTER, facing: 0, movementLeft: 8 });
    const enemy = makeUnit({ id: 'd', typeId: 'galeres', owner: 1, position: forward, movementLeft: 0 });
    const state = makeState([ship, enemy]);
    expect(legalActions(state, {})).toContainEqual({ kind: 'ram', unitId: 'a' });
  });

  it('movement phase: a ship that already rammed this turn gets no naval actions', () => {
    const ship = makeUnit({ typeId: 'biremes', position: SEA_CENTER, facing: 0, movementLeft: 3 });
    const state = makeState([ship]);
    const actions = legalActions(state, { rammedThisTurn: new Set([ship.id]) });
    expect(actions).toEqual([{ kind: 'endPhase' }]);
  });

  it('combat phase: enumerates one landAttack action per valid target', () => {
    const attacker = makeUnit({ typeId: 'fantassins', position: LAND_ROW_START, owner: 0 });
    const target = makeUnit({ typeId: 'fantassins', position: { q: 11, r: 3 }, owner: 1 });
    const state = makeState([attacker, target], 'combat');
    expect(legalActions(state, {})).toContainEqual({
      kind: 'landAttack',
      attackerIds: [attacker.id],
      defenderIds: [target.id],
    });
  });

  it('combat phase: excludes an attacker already recorded as having attacked this phase', () => {
    const attacker = makeUnit({ typeId: 'fantassins', position: LAND_ROW_START, owner: 0 });
    const target = makeUnit({ typeId: 'fantassins', position: { q: 11, r: 3 }, owner: 1 });
    const state = makeState([attacker, target], 'combat');
    const actions = legalActions(state, { attackedThisPhase: new Set([attacker.id]) });
    expect(actions.some((a) => a.kind === 'landAttack')).toBe(false);
  });

  it('combat phase: never offers an attack against a phalanx for a cavalry attacker', () => {
    const cavalry = makeUnit({ typeId: 'cavalerie-legere', position: LAND_ROW_START, owner: 0 });
    const phalanx = makeUnit({ typeId: 'phalanges', position: { q: 11, r: 3 }, owner: 1 });
    const state = makeState([cavalry, phalanx], 'combat');
    expect(legalActions(state, {}).some((a) => a.kind === 'landAttack')).toBe(false);
  });

  it('combat phase: a naval unit gets a board action against an adjacent, parallel-facing enemy ship', () => {
    const attacker = makeUnit({ id: 'a', typeId: 'galeres', position: SEA_CENTER, facing: 0, owner: 0 });
    const forward = { q: SEA_CENTER.q + DIRECTIONS[0]!.q, r: SEA_CENTER.r + DIRECTIONS[0]!.r };
    const defender = makeUnit({ id: 'd', typeId: 'galeres', position: forward, facing: 0, owner: 1 });
    const state = makeState([attacker, defender], 'combat');
    expect(legalActions(state, {})).toContainEqual({ kind: 'board', attackerId: 'a', defenderId: 'd' });
  });
});

describe('applyAction — landMove', () => {
  it('moves the unit and deducts the cheapest-path cost for an ordinary move', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: LAND_ROW_START, movementLeft: 3 });
    const state = makeState([unit]);
    const result = applyAction(state, { kind: 'landMove', unitId: unit.id, to: { q: 12, r: 3 } });
    expect(result).toMatchObject({ kind: 'landMove', charged: false });
    expect(unit.position).toEqual({ q: 12, r: 3 });
    expect(unit.movementLeft).toBe(1); // cost 2 deducted from 3
  });

  it('recognizes a qualifying cavalry charge and deducts the straight-line cost, doubling later attack via unit.charged', () => {
    const cav = makeUnit({ typeId: 'cavalerie-legere', position: LAND_ROW_START, movementLeft: 6 });
    const enemy = makeUnit({ typeId: 'fantassins', owner: 1, position: { q: 17, r: 3 } });
    const state = makeState([cav, enemy]);
    const result = applyAction(state, { kind: 'landMove', unitId: cav.id, to: { q: 16, r: 3 } });
    expect(result).toMatchObject({ kind: 'landMove', charged: true });
    expect(cav.charged).toBe(true);
    expect(cav.movementLeft).toBe(0); // full 6-point allowance spent
  });

  // Regression for a bug an adversarial review caught in the ORIGINAL
  // (pre-actions.ts) implementation, and for a gap in this file's own first
  // charge test above: (10,3)->(16,3) is an all-plain row where the
  // straight-line cost and `reachableHexes`' cheapest-path cost happen to be
  // identical (both 6), so swapping `chargeCost ?? reachableCost` back to
  // plain `reachableCost` would still pass that test. This pair — verified
  // in engine/movement.test.ts's own "returns the (costlier) straight-line
  // cost..." heavy-cavalry case — has a cheapest path (3) strictly CHEAPER
  // than the straight line (4), so only deducting the straight-line cost
  // (not the cheaper detour) can leave `movementLeft` at exactly 0.
  it('deducts the straight-line charge cost even when a cheaper detour to the same hex exists', () => {
    const cav = makeUnit({ typeId: 'cavalerie-lourde', position: { q: 20, r: 4 }, movementLeft: 4 });
    const enemy = makeUnit({ typeId: 'fantassins', owner: 1, position: { q: 20, r: 1 } });
    const state = makeState([cav, enemy]);
    const result = applyAction(state, { kind: 'landMove', unitId: cav.id, to: { q: 20, r: 2 } });
    expect(result).toMatchObject({ kind: 'landMove', charged: true });
    expect(cav.movementLeft).toBe(0); // straight-line cost 4, NOT the cheaper 3-cost detour
  });

  it('throws for a hex the unit cannot reach', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: LAND_ROW_START, movementLeft: 1 });
    const state = makeState([unit]);
    expect(() => applyAction(state, { kind: 'landMove', unitId: unit.id, to: { q: 19, r: 3 } })).toThrow();
  });

  it('throws for a naval unit — it must use navalMove instead', () => {
    const ship = makeUnit({ typeId: 'galeres', position: SEA_CENTER, facing: 0, movementLeft: 4 });
    const state = makeState([ship]);
    const forward = { q: SEA_CENTER.q + DIRECTIONS[0]!.q, r: SEA_CENTER.r + DIRECTIONS[0]!.r };
    expect(() => applyAction(state, { kind: 'landMove', unitId: ship.id, to: forward })).toThrow();
  });

  it('throws for an unknown unit id', () => {
    const state = makeState([]);
    expect(() => applyAction(state, { kind: 'landMove', unitId: 'nope', to: { q: 0, r: 0 } })).toThrow();
  });
});

describe('applyAction — navalMove / navalRotate', () => {
  it('plain move: sets position/facing/cost from reachableNavalHexes', () => {
    const ship = makeUnit({ typeId: 'biremes', position: SEA_CENTER, facing: 0, movementLeft: 2 });
    const state = makeState([ship]);
    const forwardOne = { q: SEA_CENTER.q + DIRECTIONS[0]!.q, r: SEA_CENTER.r + DIRECTIONS[0]!.r };
    applyAction(state, { kind: 'navalMove', unitId: ship.id, to: forwardOne });
    expect(ship.position).toEqual(forwardOne);
    expect(ship.facing).toBe(0);
    expect(ship.movementLeft).toBe(1);
  });

  it('moving into a hex that is also a ramming contact uses the contact facing/cost, not the cheaper plain-move facing', () => {
    // Ship facing 0 at SEA_CENTER; H1 is one hex straight ahead (cheapest
    // plain-move: cost 1, facing unchanged at 0). An enemy sits adjacent to
    // H1 in direction index 2 from H1, so arriving at H1 bow-on to it
    // requires facing 2 there — reachable at cost 1 (forward) + 2 (rotate)
    // = 3, strictly more than the plain move's cost 1. The contact must win.
    const h1 = { q: SEA_CENTER.q + DIRECTIONS[0]!.q, r: SEA_CENTER.r + DIRECTIONS[0]!.r };
    const enemyHex = { q: h1.q + DIRECTIONS[2]!.q, r: h1.r + DIRECTIONS[2]!.r };
    const ship = makeUnit({ id: 'a', typeId: 'galeres', position: SEA_CENTER, facing: 0, movementLeft: 3 });
    const enemy = makeUnit({ id: 'd', typeId: 'galeres', owner: 1, position: enemyHex, movementLeft: 0 });
    const state = makeState([ship, enemy]);
    applyAction(state, { kind: 'navalMove', unitId: 'a', to: h1 });
    expect(ship.position).toEqual(h1);
    expect(ship.facing).toBe(2);
    expect(ship.movementLeft).toBe(0); // 3 - 3, not 3 - 1
  });

  it('navalRotate turns the ship 60° and deducts 1 movement point', () => {
    const ship = makeUnit({ typeId: 'biremes', position: SEA_CENTER, facing: 0, movementLeft: 2 });
    const state = makeState([ship]);
    applyAction(state, { kind: 'navalRotate', unitId: ship.id, direction: 1 });
    expect(ship.facing).toBe(1);
    expect(ship.movementLeft).toBe(1);
    applyAction(state, { kind: 'navalRotate', unitId: ship.id, direction: -1 });
    expect(ship.facing).toBe(0);
    expect(ship.movementLeft).toBe(0);
  });

  it('throws rotating with no movement left', () => {
    const ship = makeUnit({ typeId: 'biremes', position: SEA_CENTER, facing: 0, movementLeft: 0 });
    const state = makeState([ship]);
    expect(() => applyAction(state, { kind: 'navalRotate', unitId: ship.id, direction: 1 })).toThrow();
  });
});

describe('applyAction — ram', () => {
  it('rolls, applies the ramming result, and zeroes the attacker\'s remaining movement', () => {
    const forward = { q: SEA_CENTER.q + DIRECTIONS[0]!.q, r: SEA_CENTER.r + DIRECTIONS[0]!.r };
    const attacker = makeUnit({ id: 'a', typeId: 'quintiremes', position: SEA_CENTER, facing: 0, movementLeft: 4 });
    const defender = makeUnit({ id: 'd', typeId: 'galeres', owner: 1, position: forward, movementLeft: 0 });
    const state = makeState([attacker, defender]);
    // quintiremes vs galeres at max bonus (2) succeeds on 1-5 (see navalRamming.ts) — die 1 hits.
    const result = applyAction(state, { kind: 'ram', unitId: 'a' }, fixedRng(0));
    expect(result).toMatchObject({ kind: 'ram', dieRoll: 1, hit: true, bonus: 2 });
    expect(defender.destroyed).toBe(true);
    expect(attacker.movementLeft).toBe(0);
  });

  it('a miss leaves the defender intact', () => {
    const forward = { q: SEA_CENTER.q + DIRECTIONS[0]!.q, r: SEA_CENTER.r + DIRECTIONS[0]!.r };
    const attacker = makeUnit({ id: 'a', typeId: 'galeres', position: SEA_CENTER, facing: 0, movementLeft: 8 });
    const defender = makeUnit({ id: 'd', typeId: 'quintiremes', owner: 1, position: forward, movementLeft: 0 });
    const state = makeState([attacker, defender]);
    // galeres vs quintiremes only succeeds on a 1 even at max bonus — die 6 misses.
    const result = applyAction(state, { kind: 'ram', unitId: 'a' }, fixedRng(0.9999999));
    expect(result).toMatchObject({ kind: 'ram', dieRoll: 6, hit: false });
    expect(defender.destroyed).toBe(false);
  });

  it('throws when the ship has no immediate ramming contact', () => {
    const ship = makeUnit({ typeId: 'galeres', position: SEA_CENTER, facing: 0, movementLeft: 4 });
    const state = makeState([ship]);
    expect(() => applyAction(state, { kind: 'ram', unitId: ship.id })).toThrow();
  });
});

describe('applyAction — landAttack', () => {
  it('rolls, resolves via describeLandAttack/applyLandCombatResult, and reports requiresExchangeChoice for a multi-attacker EX', () => {
    // Mirrors engine/combat.test.ts's multi-unit EX regression exactly:
    // two fantassins (attack 2 each, total 4) vs one fantassins (defense 1)
    // is a 4:1 ratio, which resolves to 'EX' on a die of 6.
    const a1 = makeUnit({ id: 'a1', typeId: 'fantassins', position: { q: 9000, r: 9000 }, owner: 0 });
    const a2 = makeUnit({ id: 'a2', typeId: 'fantassins', position: { q: 9000, r: 9001 }, owner: 0 });
    const defender = makeUnit({ id: 'd', typeId: 'fantassins', position: { q: 9001, r: 9000 }, owner: 1 });
    const state = makeState([a1, a2, defender], 'combat');
    const result = applyAction(
      state,
      { kind: 'landAttack', attackerIds: ['a1', 'a2'], defenderIds: ['d'] },
      fixedRng(0.9999999),
    );
    expect(result.kind).toBe('landAttack');
    if (result.kind !== 'landAttack') throw new Error('unreachable');
    expect(result.detail.result).toBe('EX');
    expect(result.outcome.requiresExchangeChoice).toBe(true);
    expect(defender.destroyed).toBe(true); // EX always destroys the defender(s)
    expect(a1.destroyed).toBe(false); // sacrifice choice still pending
    expect(result.defenderOriginalHexes).toEqual([{ q: 9001, r: 9000 }]);
  });

  it('a single attacker on an EX result is destroyed outright with no exchange choice', () => {
    // phalanges (attack 8) vs fantassins (defense 1): ratio clamps to the
    // table's widest column (6-1 or better), which resolves to 'EX' on a
    // die of 6 (see data/combatTable.ts's LAND_CRT, row 6).
    const attacker = makeUnit({ id: 'a', typeId: 'phalanges', position: { q: 0, r: 0 }, owner: 0 });
    const defender = makeUnit({ id: 'd', typeId: 'fantassins', position: { q: 1, r: 0 }, owner: 1 });
    const state = makeState([attacker, defender], 'combat');
    const result = applyAction(state, { kind: 'landAttack', attackerIds: ['a'], defenderIds: ['d'] }, fixedRng(0.9999999));
    if (result.kind !== 'landAttack') throw new Error('unreachable');
    expect(result.detail.result).toBe('EX');
    expect(result.outcome.requiresExchangeChoice).toBe(false);
    expect(attacker.destroyed).toBe(true);
    expect(defender.destroyed).toBe(true);
  });
});

describe('applyAction — board', () => {
  it('rolls and applies a boarding result via currentAttack/currentDefense', () => {
    const attacker = makeUnit({ id: 'a', typeId: 'galeres', position: { q: 0, r: 0 }, facing: 0, owner: 0 });
    const defender = makeUnit({ id: 'd', typeId: 'galeres', position: { q: 1, r: 0 }, facing: 0, owner: 1 });
    const state = makeState([attacker, defender], 'combat');
    // Equal force (10 vs 10) is a 1:1 ratio; die 1 -> defender loses 2 equipment (see navalBoarding.ts's table).
    const result = applyAction(state, { kind: 'board', attackerId: 'a', defenderId: 'd' }, fixedRng(0));
    expect(result).toMatchObject({ kind: 'board', dieRoll: 1 });
    if (result.kind !== 'board') throw new Error('unreachable');
    expect(result.result.side).toBe('defender');
    expect(defender.equipmentPoints).toBe(0); // full equipment (defense 10 -> ceil(10/5)=2) minus 2 lost
    expect(defender.destroyed).toBe(true);
  });
});

describe('applyAction — endPhase', () => {
  it('delegates to advancePhase — a movement phase becomes combat, resetting defendedThisPhase', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 }, owner: 0 });
    unit.defendedThisPhase = true;
    const state = makeState([unit], 'movement');
    const result = applyAction(state, { kind: 'endPhase' });
    expect(result).toEqual({ kind: 'endPhase' });
    expect(state.phase).toBe('combat');
    expect(unit.defendedThisPhase).toBe(false);
  });

  // Regression for a bug an adversarial review caught: a headless caller
  // driving nothing but legalActions/applyAction (the whole point of this
  // module) got advancePhase's phase transition WITHOUT the movement/charge
  // refill BoardScene separately applied — so after turn 1 every unit had
  // movementLeft === 0 forever and legalActions degenerated to "just
  // endPhase," silently. `applyAction`'s 'endPhase' case must refill the
  // newly active player itself.
  it('refills the newly active player\'s movement and clears charged after a full endPhase cycle, with no scene involved', () => {
    const p0Unit = makeUnit({
      id: 'p0u',
      typeId: 'cavalerie-legere',
      position: LAND_ROW_START,
      owner: 0,
      movementLeft: 2, // partially spent this (about-to-end) turn
    });
    p0Unit.charged = true;
    const p1Unit = makeUnit({
      id: 'p1u',
      typeId: 'fantassins',
      position: { q: 0, r: 0 },
      owner: 1,
      movementLeft: 0,
    });
    const state = makeState([p0Unit, p1Unit], 'movement'); // active player defaults to seat 0 (owner 0)

    applyAction(state, { kind: 'endPhase' }); // p0: movement -> combat
    applyAction(state, { kind: 'endPhase' }); // p0 combat -> p1 movement
    expect(state.phase).toBe('movement');
    expect(p1Unit.movementLeft).toBe(3); // fantassins' full printed allowance, not the stale 0

    applyAction(state, { kind: 'endPhase' }); // p1: movement -> combat
    applyAction(state, { kind: 'endPhase' }); // p1 combat -> wraps back to p0's movement

    expect(state.phase).toBe('movement');
    expect(p0Unit.movementLeft).toBe(6); // cavalerie-legere's full allowance, not the stale 2
    expect(p0Unit.charged).toBe(false);
  });

  it('legalActions is not stuck offering only endPhase once a fresh movement phase begins headlessly', () => {
    const p0Unit = makeUnit({ id: 'p0u', typeId: 'fantassins', position: LAND_ROW_START, owner: 0, movementLeft: 0 });
    const p1Unit = makeUnit({ id: 'p1u', typeId: 'fantassins', position: { q: 0, r: 0 }, owner: 1, movementLeft: 0 });
    const state = makeState([p0Unit, p1Unit], 'combat'); // p0's combat phase is about to end

    applyAction(state, { kind: 'endPhase' }); // -> p1's movement phase
    applyAction(state, { kind: 'endPhase' }); // -> p1's combat phase
    applyAction(state, { kind: 'endPhase' }); // -> wraps back to p0's fresh movement phase

    expect(state.phase).toBe('movement');
    const actions = legalActions(state, {});
    expect(actions.some((a) => a.kind === 'landMove')).toBe(true);
  });
});

describe('applyAction — action identity is by id, not by object reference', () => {
  it('accepts an Action built purely from ids/coordinates (no live Unit references)', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: LAND_ROW_START, movementLeft: 3 });
    const state = makeState([unit]);
    // Serialize and rebuild the action, proving it doesn't secretly need anything beyond ids/coords.
    const action: Action = JSON.parse(
      JSON.stringify({ kind: 'landMove', unitId: unit.id, to: { q: 11, r: 3 } }),
    );
    expect(() => applyAction(state, action)).not.toThrow();
  });
});
