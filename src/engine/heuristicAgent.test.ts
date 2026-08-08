import { describe, it, expect } from 'vitest';
import { MAP_TERRAIN } from '../data/map';
import type { HexCoord } from '../data/map';
import { getUnitType } from '../data/units';
import { legalActions, type Action } from './actions';
import { DIRECTIONS, hexAdd, hexDistance } from './hex';
import { HeuristicAgent } from './heuristicAgent';
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

  it('leaves cavalry out of a group attacking a phalanx', () => {
    // The plan.md §5 HIGH, in group form: the infantry can legally attack
    // the phalanx, and adding the cavalry would raise the force ratio — but
    // cavalry may never attack a phalanx at all, by charge or otherwise.
    const infantry = makeUnit({ id: 'inf', typeId: 'fantassins', position: hexAdd(CENTER, DIRECTIONS[0]!), owner: 0 });
    const cavalry = makeUnit({ id: 'cav', typeId: 'cavalerie-lourde', position: hexAdd(CENTER, DIRECTIONS[1]!), owner: 0 });
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: CENTER, owner: 1 });
    const state = makeGame([infantry, cavalry, phalanx], 'combat');

    const action = choose(new HeuristicAgent({ difficulty: 'ev' }), state);
    if (action.kind === 'landAttack') {
      expect(action.attackerIds).not.toContain('cav');
    } else {
      expect(action.kind).toBe('endPhase');
    }
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

  it('never spends an action on a bare naval rotation', () => {
    const ship = makeUnit({ id: 'ship', typeId: 'galeres', position: { q: 28, r: 6 }, owner: 0, movementLeft: 8 });
    const state = makeGame([ship], 'movement');

    expect(legalActions(state, {}).some((action) => action.kind === 'navalRotate')).toBe(true);
    expect(choose(new HeuristicAgent(), state).kind).not.toBe('navalRotate');
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
