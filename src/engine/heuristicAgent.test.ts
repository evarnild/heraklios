import { describe, it, expect } from 'vitest';
import { MAP_TERRAIN, hexKey as mapHexKey } from '../data/map';
import { TERRAIN_EFFECTS, canEnterTerrain } from '../data/terrain';
import type { HexCoord } from '../data/map';
import { getUnitType } from '../data/units';
import { legalActions, type Action } from './actions';
import { hexesUnderZoc } from './combat';
import { DIRECTIONS, hexAdd, hexDistance } from './hex';
import { enemyOwners, HeuristicAgent } from './heuristicAgent';
import { evaluateCharge } from './movement';
import { createSeededRng } from './rng';
import { maxEquipmentPointsForType, type GameState, type Phase, type Player, type Unit } from './state';
import { createInitialState } from './turnManager';

/** (10,5) and everything within radius 2 is plain on the shipped map (see
 * `combat.test.ts`), so a formation built here meets no terrain surprises. */
const CENTER = { q: 10, r: 5 };

/** (10,3)-(19,3) are all plain (see `fuzzHarness.ts`'s `LAND_ROW`) — a
 * straight, uniform-cost line, which is what a cavalry charge needs. */
function landRow(offset: number): HexCoord {
  return { q: 10 + offset, r: 3 };
}

function makeUnit(overrides: Partial<Unit> & { typeId: string; position: HexCoord }): Unit {
  const t = getUnitType(overrides.typeId);
  return {
    id: overrides.id ?? `u-${overrides.position.q},${overrides.position.r}`,
    owner: 0,
    movementLeft: 0,
    facing: 0,
    equipmentPoints: t.domain === 'naval' ? maxEquipmentPointsForType(t) : undefined,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
    ...overrides,
  };
}

function makeGame(units: Unit[], phase: Phase): GameState {
  const players: Player[] = [
    { id: 0, name: 'P0', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1, name: 'P1', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const state = createInitialState(players, 'multi-defender');
  state.units = units;
  state.phase = phase;
  return state;
}

/** Runs the agent against the real, engine-generated action list rather than
 * a hand-written one, so a test can't accidentally offer something
 * `legalActions` never would. */
function choose(agent: HeuristicAgent, state: GameState): Action {
  return agent.chooseNextAction(state, legalActions(state, {}));
}

function defensiveModifierAt(hex: HexCoord): number {
  const terrain = MAP_TERRAIN.get(mapHexKey(hex.q, hex.r));
  return terrain === undefined ? 0 : TERRAIN_EFFECTS[terrain].combatModifier;
}

/** A plateau hex with a land-accessible neighbour to start from — the same
 * search `combatOdds.test.ts` uses, and for the same reason: every plateau on
 * the shipped map is ringed by steep flanks, so "plateau next to plain" finds
 * nothing. */
function samplePlateauWithLowerNeighbor(): { plateau: HexCoord; below: HexCoord } {
  for (const [key, terrain] of MAP_TERRAIN) {
    if (terrain !== 'plateau') continue;
    const [q, r] = key.split(',').map(Number);
    const plateau = { q: q!, r: r! };
    for (const dir of DIRECTIONS) {
      const below = hexAdd(plateau, dir);
      const neighborTerrain = MAP_TERRAIN.get(mapHexKey(below.q, below.r));
      if (neighborTerrain === undefined || neighborTerrain === 'plateau') continue;
      if (!canEnterTerrain(neighborTerrain, 'land')) continue;
      return { plateau, below };
    }
  }
  throw new Error('no plateau hex with a land-accessible lower neighbor on the loaded map');
}

function firstPlateauHex(): HexCoord | undefined {
  for (const [key, terrain] of MAP_TERRAIN) {
    if (terrain !== 'plateau') continue;
    const [q, r] = key.split(',').map(Number);
    return { q: q!, r: r! };
  }
  return undefined;
}

describe('HeuristicAgent: combat phase', () => {
  it('attacks the target with the better expected value', () => {
    const attacker = makeUnit({ id: 'heavy', typeId: 'fantassins-lourds', position: CENTER, owner: 0 });
    const archers = makeUnit({ id: 'archers', typeId: 'archers', position: hexAdd(CENTER, DIRECTIONS[0]!), owner: 1 });
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: hexAdd(CENTER, DIRECTIONS[3]!), owner: 1 });
    // Phalanx first in `state.units`, so it is also first in `legalActions`
    // order — otherwise "picked the best target" and "picked the first
    // target offered" would be indistinguishable here.
    const state = makeGame([attacker, phalanx, archers], 'combat');

    const action = choose(new HeuristicAgent(), state);

    // 4 attack into 1 defense is the 4-1 column; 4 into a phalanx's 5 is
    // 1-2, four faces of which repel the attacker.
    expect(action.kind).toBe('landAttack');
    if (action.kind !== 'landAttack') throw new Error('unreachable');
    expect(action.defenderIds).toEqual(['archers']);
  });

  it('ends the phase rather than making a losing attack', () => {
    const attacker = makeUnit({ id: 'inf', typeId: 'fantassins', position: CENTER, owner: 0 });
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: hexAdd(CENTER, DIRECTIONS[0]!), owner: 1 });
    const state = makeGame([attacker, phalanx], 'combat');

    // The attack IS legal — the agent is declining it, not being denied it.
    expect(legalActions(state, {}).some((a) => a.kind === 'landAttack')).toBe(true);
    expect(choose(new HeuristicAgent(), state).kind).toBe('endPhase');
  });

  it("respects the cavalry/phalanx restriction it inherits from the engine", () => {
    const cavalry = makeUnit({ id: 'cav', typeId: 'cavalerie-lourde', position: CENTER, owner: 0 });
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: hexAdd(CENTER, DIRECTIONS[0]!), owner: 1 });
    const state = makeGame([cavalry, phalanx], 'combat');

    expect(legalActions(state, {}).some((a) => a.kind === 'landAttack')).toBe(false);
    expect(choose(new HeuristicAgent(), state).kind).toBe('endPhase');
  });

  it('combines attackers when concentration turns a losing attack into a winning one', () => {
    // Three light infantry (2 attack each) around one heavy infantry
    // (3 defense). Alone each is the 1-2 column and negative; two make 1-1;
    // all three make 2-1 and a positive expected value.
    const attackers = [0, 1, 2].map((i) =>
      makeUnit({ id: `a${i}`, typeId: 'fantassins', position: hexAdd(CENTER, DIRECTIONS[i]!), owner: 0 }),
    );
    const defender = makeUnit({ id: 'target', typeId: 'fantassins-lourds', position: CENTER, owner: 1 });
    const state = makeGame([...attackers, defender], 'combat');

    const action = choose(new HeuristicAgent({ difficulty: 'ev' }), state);

    expect(action.kind).toBe('landAttack');
    if (action.kind !== 'landAttack') throw new Error('unreachable');
    expect(action.attackerIds.sort()).toEqual(['a0', 'a1', 'a2']);
    expect(action.defenderIds).toEqual(['target']);
  });

  it('refuses to build a group the engine would reject, even when handed one', () => {
    // plan.md §5's HIGH in group form: a cavalry unit joining an attack on a
    // phalanx, which the rulebook forbids outright.
    //
    // The `legal` list here is DELIBERATELY MALFORMED — it contains a
    // cavalry-vs-phalanx singleton that `legalActions` would never produce.
    // That is the only way to reach the `attackerCanJoin` gate at all, and
    // the reason this test exists in this shape: adversarial review found
    // the previous version (which just called `choose`) was vacuous. Because
    // `legalActions` filters the cavalry out itself, the agent's group
    // builder never saw a cavalry candidate, the gate's loop never ran, and
    // DELETING THE GATE ENTIRELY left all 17 tests in this file green.
    //
    // Feeding the agent a bad list is exactly the scenario the gate is
    // defence against: it must not trust its input to have been filtered.
    //
    // The forces are chosen so the attack is one the agent WANTS to make and
    // the cavalry is one it would want to add: three heavy infantry (4
    // attack each) against a phalanx's 5 defense is 12-vs-5, the 2-1 column
    // and a positive expected value; adding the heavy cavalry's 6 would make
    // it 18-vs-5 and better still. So an ungated agent doesn't merely have
    // the option of including the cavalry, it is actively rewarded for it —
    // without that, the attack scores negative, the agent ends its phase,
    // and the assertion never runs. (That is precisely how the first two
    // attempts at this test came out vacuous; the second one was caught by
    // re-running the deleted-gate mutation.)
    const infantry = [0, 1, 2].map((i) =>
      makeUnit({ id: `inf${i}`, typeId: 'fantassins-lourds', position: hexAdd(CENTER, DIRECTIONS[i]!), owner: 0 }),
    );
    const cavalry = makeUnit({ id: 'cav', typeId: 'cavalerie-lourde', position: hexAdd(CENTER, DIRECTIONS[3]!), owner: 0 });
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: CENTER, owner: 1 });
    const state = makeGame([...infantry, cavalry, phalanx], 'combat');

    // Confirm the engine really does exclude the cavalry on its own, so the
    // list below is a fabrication and not just a copy of reality.
    const genuine = legalActions(state, {});
    expect(genuine.some((a) => a.kind === 'landAttack' && a.attackerIds[0] === 'cav')).toBe(false);
    expect(genuine.some((a) => a.kind === 'landAttack' && a.attackerIds[0] === 'inf0')).toBe(true);

    const malformed: Action[] = [
      { kind: 'endPhase' },
      ...infantry.map((u): Action => ({ kind: 'landAttack', attackerIds: [u.id], defenderIds: ['phalanx'] })),
      { kind: 'landAttack', attackerIds: ['cav'], defenderIds: ['phalanx'] },
    ];
    const action = new HeuristicAgent({ difficulty: 'ev' }).chooseNextAction(state, malformed);

    expect(action.kind).toBe('landAttack');
    if (action.kind !== 'landAttack') throw new Error('unreachable');
    expect(action.attackerIds).not.toContain('cav');
    expect(action.attackerIds.sort()).toEqual(['inf0', 'inf1', 'inf2']);
  });

  it('breaks a tie by legalActions order, not arbitrarily', () => {
    // Two identical archers, equidistant on identical terrain, so both
    // attacks score exactly the same. The file header names earliest-`order`
    // as the tie-break that makes a seeded game replay identically; without
    // a test, reversing it would be invisible.
    const attacker = makeUnit({ id: 'heavy', typeId: 'fantassins-lourds', position: CENTER, owner: 0 });
    const first = makeUnit({ id: 'first', typeId: 'archers', position: hexAdd(CENTER, DIRECTIONS[0]!), owner: 1 });
    const second = makeUnit({ id: 'second', typeId: 'archers', position: hexAdd(CENTER, DIRECTIONS[3]!), owner: 1 });
    const state = makeGame([attacker, first, second], 'combat');

    const legal = legalActions(state, {});
    const firstOffered = legal.find((a) => a.kind === 'landAttack');
    expect(firstOffered).toBeDefined();

    const action = new HeuristicAgent().chooseNextAction(state, legal);
    expect(action).toEqual(firstOffered);

    // And with the offer order reversed, the other one wins — proving the
    // choice follows the list rather than the units' own ordering.
    const reversed = [...legal].reverse();
    const reversedFirstOffered = reversed.find((a) => a.kind === 'landAttack');
    expect(new HeuristicAgent().chooseNextAction(state, reversed)).toEqual(reversedFirstOffered);
    expect(reversedFirstOffered).not.toEqual(firstOffered);
  });

  it('is the greedy tier that ignores its own risk, and it does not combine', () => {
    const attackers = [0, 1, 2].map((i) =>
      makeUnit({ id: `a${i}`, typeId: 'fantassins', position: hexAdd(CENTER, DIRECTIONS[i]!), owner: 0 }),
    );
    const defender = makeUnit({ id: 'target', typeId: 'fantassins-lourds', position: CENTER, owner: 1 });
    const state = makeGame([...attackers, defender], 'combat');

    const action = choose(new HeuristicAgent({ difficulty: 'greedy' }), state);

    // Greedy scores only what it might do TO the defender, so a solo attack
    // at 1-2 still looks worth making — the exact mistake that makes this
    // the easier opponent.
    expect(action.kind).toBe('landAttack');
    if (action.kind !== 'landAttack') throw new Error('unreachable');
    expect(action.attackerIds).toHaveLength(1);
  });

  it('is deterministic without an rng, and still legal with one', () => {
    const attacker = makeUnit({ id: 'heavy', typeId: 'fantassins-lourds', position: CENTER, owner: 0 });
    const archers = makeUnit({ id: 'archers', typeId: 'archers', position: hexAdd(CENTER, DIRECTIONS[0]!), owner: 1 });
    const state = makeGame([attacker, archers], 'combat');

    const agent = new HeuristicAgent();
    expect(choose(agent, state)).toEqual(choose(agent, state));

    const seeded = new HeuristicAgent({ rng: createSeededRng(7) });
    const legal = legalActions(state, {});
    const chosen = seeded.chooseNextAction(state, legal);
    expect(chosen.kind).toBe('landAttack');
  });
});

describe('HeuristicAgent: movement phase', () => {
  it('advances toward the enemy when there is nothing else to do', () => {
    const unit = makeUnit({ id: 'inf', typeId: 'fantassins', position: landRow(0), owner: 0, movementLeft: 3 });
    const enemy = makeUnit({ id: 'foe', typeId: 'fantassins', position: landRow(9), owner: 1 });
    const state = makeGame([unit, enemy], 'movement');

    const action = choose(new HeuristicAgent(), state);

    expect(action.kind).toBe('landMove');
    if (action.kind !== 'landMove') throw new Error('unreachable');
    expect(hexDistance(action.to, enemy.position)).toBeLessThan(hexDistance(unit.position, enemy.position));
  });

  it('takes a cavalry charge when the geometry offers one', () => {
    // Light cavalry: 6 movement, on the plain row, with an enemy exactly 7
    // hexes away — so spending the full allowance in a straight line lands
    // adjacent to it, which is what `evaluateCharge` requires.
    //
    // `approach` is zeroed DELIBERATELY, and the test is worthless without
    // it: at the default weight the charge hex is also simply the furthest
    // hex forward, so "sought a charge" and "walked as far as it could" are
    // the same move and the assertion below proves nothing about charges.
    // Confirmed by mutation — scoring the destination as an ordinary
    // (uncharged) move left the earlier version of this test green. With
    // approach at zero the ONLY thing that can move this unit is the value
    // of what it could hit, so an agent blind to the charge sees a 3-attack
    // unit facing 1 defense across an enemy ZOC, scores every destination at
    // or below zero, and ends its phase instead.
    const cavalry = makeUnit({ id: 'cav', typeId: 'cavalerie-legere', position: landRow(0), owner: 0, movementLeft: 6 });
    const enemy = makeUnit({ id: 'foe', typeId: 'archers', position: landRow(7), owner: 1 });
    const state = makeGame([cavalry, enemy], 'movement');

    const action = choose(new HeuristicAgent({ weights: { approach: 0 } }), state);

    expect(action.kind).toBe('landMove');
    if (action.kind !== 'landMove') throw new Error('unreachable');
    expect(evaluateCharge(state, cavalry, action.to)).not.toBeNull();
  });

  it('still advances on the charge line at the default weights', () => {
    // The companion to the isolated test above: with `approach` restored the
    // agent must still actually move (this is the ordinary case), it just
    // can no longer be said to have moved BECAUSE of the charge.
    const cavalry = makeUnit({ id: 'cav', typeId: 'cavalerie-legere', position: landRow(0), owner: 0, movementLeft: 6 });
    const enemy = makeUnit({ id: 'foe', typeId: 'archers', position: landRow(7), owner: 1 });
    const state = makeGame([cavalry, enemy], 'movement');

    const action = choose(new HeuristicAgent(), state);
    expect(action.kind).toBe('landMove');
    if (action.kind !== 'landMove') throw new Error('unreachable');
    expect(hexDistance(action.to, enemy.position)).toBe(1);
  });

  it('ends the phase when no move improves the position', () => {
    // Two friendly units alone on the board: nothing to approach, nothing to
    // strike, so any move is pure wandering.
    const a = makeUnit({ id: 'a', typeId: 'fantassins', position: landRow(0), owner: 0, movementLeft: 3 });
    const b = makeUnit({ id: 'b', typeId: 'fantassins', position: landRow(4), owner: 0, movementLeft: 3 });
    const state = makeGame([a, b], 'movement');

    expect(legalActions(state, {}).some((action) => action.kind === 'landMove')).toBe(true);
    expect(choose(new HeuristicAgent(), state).kind).toBe('endPhase');
  });

  it('takes the high ground when nothing else is going on', () => {
    // No enemies at all, so approach and strike are both zero for every
    // destination and the ONLY thing that can distinguish one hex from
    // another is its defensive terrain. An agent that ignores terrain scores
    // every move at 0, falls under `minMoveScore`, and ends its phase —
    // which is what makes this test kill the mutant rather than merely pass.
    const { plateau, below } = samplePlateauWithLowerNeighbor();
    const unit = makeUnit({ id: 'inf', typeId: 'fantassins', position: below, owner: 0, movementLeft: 3 });
    const state = makeGame([unit], 'movement');

    const action = choose(new HeuristicAgent({ weights: { approach: 0 } }), state);

    expect(action.kind).toBe('landMove');
    if (action.kind !== 'landMove') throw new Error('unreachable');
    expect(defensiveModifierAt(action.to)).toBeGreaterThan(0);
    expect(MAP_TERRAIN.get(mapHexKey(action.to.q, action.to.r))).toBe('plateau');

    // The control: the same position, scored without the terrain term.
    expect(choose(new HeuristicAgent({ weights: { approach: 0, terrainDefense: 0 } }), state).kind).toBe('endPhase');
  });

  it('will not walk into an enemy zone of control for nothing', () => {
    // Light cavalry two hexes from a phalanx, with one movement point. It
    // may never attack a phalanx (`cavalryMayAttack`), so closing the
    // distance buys it no attack at all — just the loss of its freedom to
    // move next turn. Approach alone (+0.6) would take the step; the ZOC
    // penalty (-1) correctly outweighs it.
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: CENTER, owner: 1 });
    const cavalry = makeUnit({
      id: 'cav',
      typeId: 'cavalerie-legere',
      position: hexAdd(CENTER, { q: 2, r: 0 }),
      owner: 0,
      movementLeft: 1,
    });
    const state = makeGame([cavalry, phalanx], 'movement');
    const enemyZoc = hexesUnderZoc(state, 0);

    expect(choose(new HeuristicAgent(), state).kind).toBe('endPhase');

    // The control: without the penalty it steps straight into the ZOC, so
    // the hex really was on offer and really is ZOC-covered.
    const unguarded = choose(new HeuristicAgent({ weights: { zocPenalty: 0 } }), state);
    expect(unguarded.kind).toBe('landMove');
    if (unguarded.kind !== 'landMove') throw new Error('unreachable');
    expect(enemyZoc.has(mapHexKey(unguarded.to.q, unguarded.to.r))).toBe(true);
  });

  it('never spends an action on a bare naval rotation', () => {
    const ship = makeUnit({ id: 'ship', typeId: 'galeres', position: { q: 28, r: 6 }, owner: 0, movementLeft: 8 });
    const state = makeGame([ship], 'movement');

    expect(legalActions(state, {}).some((action) => action.kind === 'navalRotate')).toBe(true);
    expect(choose(new HeuristicAgent(), state).kind).not.toBe('navalRotate');
  });

  it('the lookahead tier avoids a move whose best enemy reply is too strong', () => {
    const archer = makeUnit({ id: 'archer', typeId: 'archers', position: landRow(0), owner: 0, movementLeft: 3 });
    const heavy = makeUnit({ id: 'heavy', typeId: 'fantassins-lourds', position: landRow(4), owner: 1 });
    const state = makeGame([archer, heavy], 'movement');
    const weights = { approach: 0.5, terrainDefense: 0, zocPenalty: 0, strike: 0 };

    const evAction = choose(new HeuristicAgent({ difficulty: 'ev', weights }), state);
    expect(evAction.kind).toBe('landMove');
    if (evAction.kind !== 'landMove') throw new Error('unreachable');
    expect(hexDistance(evAction.to, heavy.position)).toBe(1);

    const lookaheadAction = choose(new HeuristicAgent({ difficulty: 'lookahead', weights }), state);
    expect(lookaheadAction.kind).toBe('landMove');
    if (lookaheadAction.kind !== 'landMove') throw new Error('unreachable');
    expect(hexDistance(lookaheadAction.to, heavy.position)).toBeGreaterThan(1);
  });

  it('lookahead probes cloned states without mutating the real position', () => {
    const archer = makeUnit({ id: 'archer', typeId: 'archers', position: landRow(0), owner: 0, movementLeft: 3 });
    const heavy = makeUnit({ id: 'heavy', typeId: 'fantassins-lourds', position: landRow(4), owner: 1 });
    const state = makeGame([archer, heavy], 'movement');
    const before = structuredClone(state);

    choose(new HeuristicAgent({ difficulty: 'lookahead' }), state);

    expect(state).toEqual(before);
  });

  it('the lookahead tier gates a reply below minAttackValue out of the threat penalty', () => {
    // Same position as "avoids a move whose best enemy reply is too strong",
    // but with minAttackValue raised well above the heavy infantry's actual
    // attack EV — so every possible reply is gated out, the threat penalty
    // never fires, and lookahead should make the exact move ev does.
    const archer = makeUnit({ id: 'archer', typeId: 'archers', position: landRow(0), owner: 0, movementLeft: 3 });
    const heavy = makeUnit({ id: 'heavy', typeId: 'fantassins-lourds', position: landRow(4), owner: 1 });
    const state = makeGame([archer, heavy], 'movement');
    const weights = { approach: 0.5, terrainDefense: 0, zocPenalty: 0, strike: 0, minAttackValue: 100 };

    const evAction = choose(new HeuristicAgent({ difficulty: 'ev', weights }), state);
    const lookaheadAction = choose(new HeuristicAgent({ difficulty: 'lookahead', weights }), state);

    expect(lookaheadAction).toEqual(evAction);
  });

  it('the lookahead tier resets a stale defendedThisPhase flag before probing an enemy reply', () => {
    // Same position as "avoids a move whose best enemy reply is too
    // strong". `defendedThisPhase` matters on whoever is being ATTACKED in
    // the hypothetical combat phase — here, the MOVER (`archer`), since the
    // probe asks "what could the enemy do to the unit I'm about to move."
    // If `normalizedThreatProbeClone`'s reset were missing, a mover that
    // already has `defendedThisPhase: true` set (as it would after being
    // attacked earlier in the same round, in a 3-4 player game) would be
    // silently excluded from `validTargets` in the threat probe
    // (`combat.ts`), understating the threat and changing the move chosen.
    // Asserting the choice is IDENTICAL regardless of the mover's initial
    // flag proves the probe always normalizes it away.
    const weights = { approach: 0.5, terrainDefense: 0, zocPenalty: 0, strike: 0 };
    const freshState = makeGame(
      [
        makeUnit({ id: 'archer', typeId: 'archers', position: landRow(0), owner: 0, movementLeft: 3, defendedThisPhase: false }),
        makeUnit({ id: 'heavy', typeId: 'fantassins-lourds', position: landRow(4), owner: 1 }),
      ],
      'movement',
    );
    const staleState = makeGame(
      [
        makeUnit({ id: 'archer', typeId: 'archers', position: landRow(0), owner: 0, movementLeft: 3, defendedThisPhase: true }),
        makeUnit({ id: 'heavy', typeId: 'fantassins-lourds', position: landRow(4), owner: 1 }),
      ],
      'movement',
    );

    const freshAction = choose(new HeuristicAgent({ difficulty: 'lookahead', weights }), freshState);
    const staleAction = choose(new HeuristicAgent({ difficulty: 'lookahead', weights }), staleState);

    expect(staleAction).toEqual(freshAction);
  });

  it('the lookahead tier resets a stale charged flag before probing an enemy reply', () => {
    // Same idea, for `charged`: only cavalry doubles its attack when
    // charged (`state.ts`'s `currentAttack`), so this needs a cavalry enemy
    // rather than heavy infantry. A stale `charged: true` left over from
    // before the probe's hypothetical combat phase would double the enemy's
    // threat and could change which move looks safest. `minAttackValue: 2`
    // sits between this matchup's uncharged EV (0.67) and charged EV (3.33,
    // verified by direct `evaluateAttack` computation), so this is not just
    // "a bigger number" — it's specifically the range where the flag flips
    // whether the reply clears `enemyThreatAgainstUnit`'s threat gate at
    // all, which is what makes this test able to fail if the reset breaks.
    const weights = { approach: 0.5, terrainDefense: 0, zocPenalty: 0, strike: 0, minAttackValue: 2 };
    const freshState = makeGame(
      [
        makeUnit({ id: 'archer', typeId: 'archers', position: landRow(0), owner: 0, movementLeft: 3 }),
        makeUnit({ id: 'cav', typeId: 'cavalerie-legere', position: landRow(4), owner: 1, charged: false }),
      ],
      'movement',
    );
    const staleState = makeGame(
      [
        makeUnit({ id: 'archer', typeId: 'archers', position: landRow(0), owner: 0, movementLeft: 3 }),
        makeUnit({ id: 'cav', typeId: 'cavalerie-legere', position: landRow(4), owner: 1, charged: true }),
      ],
      'movement',
    );

    const freshAction = choose(new HeuristicAgent({ difficulty: 'lookahead', weights }), freshState);
    const staleAction = choose(new HeuristicAgent({ difficulty: 'lookahead', weights }), staleState);

    expect(staleAction).toEqual(freshAction);
  });

  it('the lookahead tier is risk-aware like ev: will not walk into an enemy zone of control for nothing', () => {
    // Mirrors "will not walk into an enemy zone of control for nothing"
    // above, but for the lookahead tier — with non-zero terrain/zoc weights,
    // unlike the tier's other dedicated tests, which zero them out and so
    // can't tell `riskAware` apart from always-false.
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: CENTER, owner: 1 });
    const cavalry = makeUnit({
      id: 'cav',
      typeId: 'cavalerie-legere',
      position: hexAdd(CENTER, { q: 2, r: 0 }),
      owner: 0,
      movementLeft: 1,
    });
    const state = makeGame([cavalry, phalanx], 'movement');

    expect(choose(new HeuristicAgent({ difficulty: 'lookahead' }), state).kind).toBe('endPhase');
  });
});

describe('enemyOwners', () => {
  it('excludes the given owner even when it is the only one with living units', () => {
    const own = makeUnit({ id: 'own', typeId: 'archers', position: CENTER, owner: 0 });
    const state = makeGame([own], 'movement');

    expect(enemyOwners(state, 0)).toEqual([]);
  });

  it('lists every other owner with a living unit, and only those', () => {
    const own = makeUnit({ id: 'own', typeId: 'archers', position: CENTER, owner: 0 });
    const enemy = makeUnit({ id: 'enemy', typeId: 'archers', position: landRow(4), owner: 1 });
    const dead = makeUnit({ id: 'dead', typeId: 'archers', position: landRow(6), owner: 1, destroyed: true });
    const state = makeGame([own, enemy, dead], 'movement');

    expect(enemyOwners(state, 0)).toEqual([1]);
  });
});

describe('HeuristicAgent: mid-resolution decisions', () => {
  it('retreats onto defensible ground when offered the choice', async () => {
    const plateau = firstPlateauHex();
    if (!plateau) throw new Error('no plateau on the loaded map');
    const unit = makeUnit({ id: 'inf', typeId: 'fantassins', position: CENTER, owner: 0 });
    const state = makeGame([unit], 'combat');

    // Options are supplied directly, as `legalRetreatHexes` would: one flat,
    // one that adds +2 to every future attacker's die roll.
    const chosen = await new HeuristicAgent().chooseRetreat(state, unit, [hexAdd(CENTER, DIRECTIONS[0]!), plateau]);
    expect(chosen).toEqual(plateau);
  });

  it('pushes the friendly that can get out of the way without a cascade', async () => {
    const retreating = makeUnit({ id: 'r', typeId: 'fantassins', position: CENTER, owner: 0 });
    const roomy = makeUnit({ id: 'roomy', typeId: 'fantassins', position: hexAdd(CENTER, DIRECTIONS[0]!), owner: 0 });
    // `boxed` is ringed by its own friends, so pushing it would cascade
    // further (plan.md §12.3); `roomy` has open hexes all around it.
    const boxedPosition = hexAdd(CENTER, DIRECTIONS[3]!);
    const boxed = makeUnit({ id: 'boxed', typeId: 'fantassins', position: boxedPosition, owner: 0 });
    const fillers = DIRECTIONS.map((d) => hexAdd(boxedPosition, d))
      .filter((hex) => hexDistance(hex, CENTER) > 0)
      .map((hex, i) => makeUnit({ id: `f${i}`, typeId: 'fantassins', position: hex, owner: 0 }));
    const state = makeGame([retreating, roomy, boxed, ...fillers], 'combat');

    const chosen = await new HeuristicAgent().choosePushTarget(state, retreating, [boxed, roomy]);
    expect(chosen.id).toBe('roomy');
  });

  it('advances into open ground and declines into a trap', async () => {
    const attacker = makeUnit({ id: 'atk', typeId: 'cavalerie-legere', position: hexAdd(CENTER, DIRECTIONS[0]!), owner: 0 });

    const openState = makeGame([attacker], 'combat');
    expect((await new HeuristicAgent().chooseAdvance(openState, [attacker], CENTER))?.id).toBe('atk');

    // The same hex with three enemies around it: light cavalry (defense 2)
    // has no business standing there.
    const enemies = [1, 2, 3].map((i) =>
      makeUnit({ id: `e${i}`, typeId: 'fantassins', position: hexAdd(CENTER, DIRECTIONS[i]!), owner: 1 }),
    );
    const trapState = makeGame([attacker, ...enemies], 'combat');
    expect(await new HeuristicAgent().chooseAdvance(trapState, [attacker], CENTER)).toBeNull();
  });

  it('pays an exchange with the cheapest units that cover it', async () => {
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: CENTER, owner: 0 });
    const infantry = makeUnit({ id: 'inf', typeId: 'fantassins', position: hexAdd(CENTER, DIRECTIONS[0]!), owner: 0 });
    const state = makeGame([phalanx, infantry], 'combat');

    const chosen = await new HeuristicAgent().chooseExchangeSacrifice(state, [phalanx, infantry], 2);
    expect(chosen.map((u) => u.id)).toEqual(['inf']);
  });
});

/** The `'random'` tier must be a real delegation to `RandomAgent`, not a
 * separate implementation that happens to look random. */
describe("HeuristicAgent: the 'random' tier", () => {
  it('picks from the legal set and can pick something the EV tier would refuse', () => {
    const attacker = makeUnit({ id: 'inf', typeId: 'fantassins', position: CENTER, owner: 0 });
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: hexAdd(CENTER, DIRECTIONS[0]!), owner: 1 });
    const state = makeGame([attacker, phalanx], 'combat');
    const legal = legalActions(state, {});

    const agent = new HeuristicAgent({ difficulty: 'random', rng: createSeededRng(3) });
    const kinds = new Set<string>();
    for (let i = 0; i < 40; i++) kinds.add(agent.chooseNextAction(state, legal).kind);

    // Over 40 seeded draws from a two-action list it takes both, including
    // the attack the EV tier declines in the test above.
    expect(kinds).toEqual(new Set(['endPhase', 'landAttack']));
  });
});
