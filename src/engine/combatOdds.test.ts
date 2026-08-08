import { describe, it, expect } from 'vitest';
import { MAP_TERRAIN, hexKey as mapHexKey } from '../data/map';
import { canEnterTerrain } from '../data/terrain';
import { checkRangedEligibility } from './combat';
import type { HexCoord } from '../data/map';
import { maxEquipmentPointsForType } from './state';
import { getUnitType } from '../data/units';
import { DIRECTIONS, hexAdd } from './hex';
import { createInitialState } from './turnManager';
import type { GameState, Unit } from './state';
import {
  attackOutcomeDistribution,
  cheapestSacrifice,
  evaluateAttack,
  evaluateBoarding,
  evaluateRam,
  probabilityOf,
  rammingHitChance,
  unitValue,
  wouldBeEliminatedByRetreat,
  RETREAT_TEMPO_VALUE,
} from './combatOdds';

/** (10,5) and everything within radius 2 is plain on the shipped map — the
 * same open patch `combat.test.ts` and `fuzzHarness.ts` build formations on. */
const CENTER = { q: 10, r: 5 };
const NEIGHBOR = hexAdd(CENTER, DIRECTIONS[0]!);

function makeUnit(overrides: Partial<Unit> & { typeId: string; position: HexCoord }): Unit {
  const t = getUnitType(overrides.typeId);
  return {
    id: overrides.id ?? `u-${overrides.typeId}-${overrides.position.q},${overrides.position.r}`,
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

function makeState(units: Unit[]): GameState {
  const state = createInitialState([], 'multi-defender');
  state.units = units;
  return state;
}

/**
 * A real plateau hex on the currently-loaded map, plus a neighbouring hex an
 * infantry unit can stand on to attack it from lower ground — found by
 * search rather than pinned to a coordinate, so these tests survive a map
 * edit (the same reasoning as `combat.test.ts`'s `sampleRiverEdge`).
 *
 * Note the neighbour is NOT required to be plain: on the shipped map every
 * plateau is ringed by steep flanks, so a "plateau with a plain neighbour"
 * search finds nothing. Any non-plateau terrain does the job, because the
 * conditional "+2 if the attackers come from below" bonus triggers on the
 * attacker's terrain merely DIFFERING from the defender's (see
 * `computeLandAttackDetail`).
 */
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

describe('attackOutcomeDistribution', () => {
  it('is exact over all six faces, not a sample', () => {
    const attacker = makeUnit({ typeId: 'fantassins', position: CENTER, owner: 0 });
    const defender = makeUnit({ typeId: 'fantassins', position: NEIGHBOR, owner: 1 });

    const distribution = attackOutcomeDistribution([attacker], [defender]);

    // 2 attack vs 1 defense = the 2-1 column, whose printed CRT rows are
    // DR/DR/DR/DR/AR/AR for die 1-6 (data/combatTable.ts).
    expect(distribution.ratioLabel).toBe('2-1');
    expect(distribution.resultByFace).toEqual(['DR', 'DR', 'DR', 'DR', 'AR', 'AR']);
    expect(distribution.faceCounts).toEqual({ AE: 0, AR: 2, DE: 0, DR: 4, EX: 0 });
    expect(probabilityOf(distribution, 'DR')).toBeCloseTo(4 / 6, 10);

    const total = Object.values(distribution.faceCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(6);
  });

  it('folds the terrain modifier into the face counts via the CRT clamp', () => {
    // The distinguishing property of counting FACES rather than rows: a +2
    // defensive modifier pushes faces 4, 5 and 6 all onto row 6.
    const { plateau, below } = samplePlateauWithLowerNeighbor();
    const attacker = makeUnit({ typeId: 'fantassins', position: below, owner: 0 });
    const defender = makeUnit({ typeId: 'fantassins', position: plateau, owner: 1 });

    const distribution = attackOutcomeDistribution([attacker], [defender]);

    expect(distribution.terrainModifier).toBe(2);
    expect(distribution.ratioLabel).toBe('2-1'); // unchanged: terrain shifts the die, not the ratio
    // Modified rolls 3,4,5,6,6,6 on the 2-1 column => DR,DR,AR,AR,AR,AR.
    expect(distribution.resultByFace).toEqual(['DR', 'DR', 'AR', 'AR', 'AR', 'AR']);
    expect(distribution.faceCounts.AR).toBe(4);

    // ...and the identical matchup on open ground is the flat 4-DR case
    // above, so the terrain is demonstrably what moved the odds.
    const openAttacker = makeUnit({ typeId: 'fantassins', position: CENTER, owner: 0 });
    const openDefender = makeUnit({ typeId: 'fantassins', position: NEIGHBOR, owner: 1 });
    expect(attackOutcomeDistribution([openAttacker], [openDefender]).faceCounts.AR).toBe(2);
  });

  it('sums attack force across a combined group, changing the column', () => {
    const a1 = makeUnit({ id: 'a1', typeId: 'fantassins', position: CENTER, owner: 0 });
    const a2 = makeUnit({ id: 'a2', typeId: 'fantassins', position: hexAdd(CENTER, DIRECTIONS[1]!), owner: 0 });
    const defender = makeUnit({ typeId: 'fantassins-lourds', position: NEIGHBOR, owner: 1 });

    // 2 vs 3 rounds down to the 1-2 column; 4 vs 3 reaches 1-1.
    expect(attackOutcomeDistribution([a1], [defender]).ratioLabel).toBe('1-2');
    expect(attackOutcomeDistribution([a1, a2], [defender]).ratioLabel).toBe('1-1');
  });
});

describe('evaluateAttack', () => {
  it('scores a favourable attack positive and a hopeless one negative', () => {
    const heavy = makeUnit({ id: 'h', typeId: 'fantassins-lourds', position: CENTER, owner: 0 });
    const archers = makeUnit({ id: 'x', typeId: 'archers', position: NEIGHBOR, owner: 1 });

    // 4 attack vs 1 defense = the 4-1 column: a kill, four retreats and one
    // exchange.
    const good = evaluateAttack(makeState([heavy, archers]), [heavy], [archers]);
    expect(good.expectedValue).toBeGreaterThan(0);

    // Roles reversed, with the archers at their actual firing range of 2
    // (they are not `meleeCapable`, so adjacency is not a legal attack for
    // them at all). Their attack force is 0, not 2 — see the dedicated test
    // below — so this lands on the 1-5 column, five of whose six faces
    // eliminate the attacker outright.
    const phalanx = makeUnit({ id: 'p', typeId: 'phalanges', position: CENTER, owner: 0 });
    const distantArchers = makeUnit({ id: 'x2', typeId: 'archers', position: hexAdd(CENTER, { q: 2, r: 0 }), owner: 1 });
    const bad = evaluateAttack(makeState([phalanx, distantArchers]), [distantArchers], [phalanx]);
    expect(bad.distribution.ratioLabel).toBe('1-5');
    expect(bad.expectedValue).toBeLessThan(0);
    expect(bad.distribution.faceCounts.AE).toBe(5);
  });

  it('inherits the engine scoring a ranged attack at zero force (pre-existing defect)', () => {
    // NOT a property of this module, and NOT introduced by this branch —
    // recorded here because the exact-odds layer is what finally makes the
    // consequence measurable.
    //
    // `describeLandAttack` sums `currentAttack`, which returns
    // `UnitType.attack`; plain `archers` are `attack: 0, rangedAttack: 2`
    // (data/units.ts), and `rangedAttack` is consulted ONLY for eligibility
    // (`checkRangedEligibility`), never for force. So an archer volley always
    // resolves at attack force 0 — the 1-5 column — and kills the archer on
    // five faces out of six, whatever it shoots at. `fantassins-archers`
    // (`attack: 2`) are unaffected, which is why this has gone unnoticed.
    //
    // The practical upshot for the agent: no EV tier will ever fire a plain
    // archer, correctly, because doing so is suicide under the current
    // resolution. Fixing it changes live hotseat combat, so it belongs on
    // its own reviewed branch rather than riding along with the AI.
    const archers = makeUnit({ id: 'x', typeId: 'archers', position: CENTER, owner: 0 });
    const target = makeUnit({ id: 't', typeId: 'fantassins', position: hexAdd(CENTER, { q: 2, r: 0 }), owner: 1 });

    expect(checkRangedEligibility(archers, 2).canAttack).toBe(true); // the shot is legal
    const evaluation = evaluateAttack(makeState([archers, target]), [archers], [target]);
    expect(evaluation.distribution.attackForce).toBe(0); // ...and worth nothing
    expect(evaluation.distribution.ratioLabel).toBe('1-5');
    expect(evaluation.distribution.faceCounts.AE).toBe(5);
    expect(evaluation.expectedValue).toBeLessThan(0);
  });

  it('does not treat an overwhelming ratio as automatically worth taking', () => {
    // A phalanx (15 pts) alone against archers (5 pts) is 8:1, past the
    // table's 6-1 column — and that column's die 5 and 6 are 'EX', which
    // with a single attacker destroys it outright (`applyLandCombatResult`
    // offers no choice below two attackers). Four faces win 5 points, two
    // faces lose 10, and the whole attack prices at exactly zero.
    //
    // Kept as a test because it is the least intuitive thing this valuation
    // says, and it is a genuine consequence of the printed CRT rather than
    // an artefact of the model: an expensive unit should not solo-charge a
    // cheap one just because the ratio looks free.
    const phalanx = makeUnit({ id: 'p', typeId: 'phalanges', position: CENTER, owner: 0 });
    const archers = makeUnit({ id: 'x', typeId: 'archers', position: NEIGHBOR, owner: 1 });
    const evaluation = evaluateAttack(makeState([phalanx, archers]), [phalanx], [archers]);

    expect(evaluation.distribution.ratioLabel).toBe('6-1');
    expect(evaluation.distribution.faceCounts).toEqual({ AE: 0, AR: 0, DE: 4, DR: 0, EX: 2 });
    expect(evaluation.expectedValue).toBe(0);
  });

  it('prices a retreat the defender cannot survive as a full kill, not as tempo', () => {
    // (4,9) is a plateau ringed by six steep-flank hexes on the shipped map —
    // terrain cavalry may never enter (plan.md §6.8). A cavalry unit forced
    // to retreat from there is eliminated, with no enemy ZOC involved.
    const trapped = makeUnit({ id: 'trapped', typeId: 'cavalerie-legere', position: { q: 4, r: 9 }, owner: 1 });
    const attacker = makeUnit({ id: 'atk', typeId: 'fantassins', position: hexAdd({ q: 4, r: 9 }, DIRECTIONS[0]!), owner: 0 });
    const state = makeState([trapped, attacker]);

    expect(wouldBeEliminatedByRetreat(state, trapped)).toBe(true);
    const evaluation = evaluateAttack(state, [attacker], [trapped]);
    // A DR against a unit with nowhere to go is worth its whole 5 points,
    // not the 1-point tempo swing an ordinary retreat scores.
    expect(evaluation.valueByResult.DR).toBe(unitValue(trapped));
    expect(evaluation.valueByResult.DR).toBeGreaterThan(RETREAT_TEMPO_VALUE);

    // Contrast: the same hex, a unit type that CAN retreat off it.
    const infantry = makeUnit({ id: 'inf', typeId: 'fantassins', position: { q: 4, r: 9 }, owner: 1 });
    const openState = makeState([infantry, attacker]);
    expect(wouldBeEliminatedByRetreat(openState, infantry)).toBe(false);
    expect(evaluateAttack(openState, [attacker], [infantry]).valueByResult.DR).toBe(RETREAT_TEMPO_VALUE);
  });

  it('charges the retreat tempo once per side, not once per unit', () => {
    // The mutation this guards: making `retreatCost` per-unit turns a
    // three-unit attack's AR from -1 into -3 and flips this whole attack
    // negative, so an agent using it declines every combined attack (see
    // RETREAT_TEMPO_VALUE's doc comment).
    const attackers = [0, 1, 2].map((i) =>
      makeUnit({ id: `a${i}`, typeId: 'fantassins', position: hexAdd(CENTER, DIRECTIONS[i]!), owner: 0 }),
    );
    const defender = makeUnit({ id: 'd', typeId: 'fantassins-lourds', position: CENTER, owner: 1 });
    const state = makeState([...attackers, defender]);

    const grouped = evaluateAttack(state, attackers, [defender]);
    expect(grouped.distribution.ratioLabel).toBe('2-1'); // 6 attack vs 3 defense
    expect(grouped.valueByResult.AR).toBe(-RETREAT_TEMPO_VALUE);
    expect(grouped.expectedValue).toBeGreaterThan(0);

    // ...and the same units attacking one at a time are a losing proposition,
    // which is exactly the concentration the CRT is meant to reward.
    const solo = evaluateAttack(state, [attackers[0]!], [defender]);
    expect(solo.distribution.ratioLabel).toBe('1-2');
    expect(solo.expectedValue).toBeLessThan(0);
  });

  it('expectedValue is exactly the face-weighted mean of valueByResult', () => {
    const attacker = makeUnit({ id: 'a', typeId: 'cavalerie-lourde', position: CENTER, owner: 0 });
    const defender = makeUnit({ id: 'd', typeId: 'archers', position: NEIGHBOR, owner: 1 });
    const evaluation = evaluateAttack(makeState([attacker, defender]), [attacker], [defender]);

    const manual =
      (Object.entries(evaluation.distribution.faceCounts) as [keyof typeof evaluation.valueByResult, number][]).reduce(
        (sum, [result, faces]) => sum + faces * evaluation.valueByResult[result],
        0,
      ) / 6;
    expect(evaluation.expectedValue).toBeCloseTo(manual, 10);
  });

  it('separates the greedy view (enemy loss only) from the EV view (net swing)', () => {
    // Light cavalry (5 pts, attack 3) into heavy infantry (10 pts, defense 3)
    // is the 1-1 column: three faces AR, and on this open ground the cavalry
    // survives them, so the two views differ by the attacker's own risk.
    const attacker = makeUnit({ id: 'a', typeId: 'cavalerie-legere', position: CENTER, owner: 0 });
    const defender = makeUnit({ id: 'd', typeId: 'fantassins-lourds', position: NEIGHBOR, owner: 1 });
    const evaluation = evaluateAttack(makeState([attacker, defender]), [attacker], [defender]);

    expect(evaluation.expectedAttackerLoss).toBeGreaterThan(0);
    expect(evaluation.expectedValue).toBeCloseTo(
      evaluation.expectedDefenderLoss - evaluation.expectedAttackerLoss,
      10,
    );
  });
});

describe('cheapestSacrifice', () => {
  it('finds the cheapest subset, not the one a value-per-force ordering would take', () => {
    // The case a greedy ordering gets wrong: the phalanx has the best
    // force-per-point ratio of the three but costs 15, while the two cheap
    // units together clear the same threshold for 10.
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: CENTER, owner: 0 }); // 15 pts, attack 8
    const cavalry = makeUnit({ id: 'cav', typeId: 'cavalerie-legere', position: CENTER, owner: 0 }); // 5 pts, attack 3
    const infantry = makeUnit({ id: 'inf', typeId: 'fantassins', position: CENTER, owner: 0 }); // 5 pts, attack 2

    const chosen = cheapestSacrifice([phalanx, cavalry, infantry], 5);
    expect(chosen.map((u) => u.id).sort()).toEqual(['cav', 'inf']);
  });

  it('returns a single unit when one alone is cheapest', () => {
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: CENTER, owner: 0 });
    const infantry = makeUnit({ id: 'inf', typeId: 'fantassins', position: CENTER, owner: 0 });
    expect(cheapestSacrifice([phalanx, infantry], 2).map((u) => u.id)).toEqual(['inf']);
  });

  it('reports failure with an empty array rather than under-paying', () => {
    const infantry = makeUnit({ id: 'inf', typeId: 'fantassins', position: CENTER, owner: 0 });
    expect(cheapestSacrifice([infantry], 99)).toEqual([]);
  });

  it('is used by evaluateAttack to price an exchange', () => {
    // Two attackers, so an 'EX' offers a choice: the valuation must charge
    // the cheap unit, not the whole group.
    const phalanx = makeUnit({ id: 'phalanx', typeId: 'phalanges', position: CENTER, owner: 0 });
    const infantry = makeUnit({ id: 'inf', typeId: 'fantassins', position: hexAdd(CENTER, DIRECTIONS[1]!), owner: 0 });
    const archers = makeUnit({ id: 'arch', typeId: 'archers', position: NEIGHBOR, owner: 1 });
    const evaluation = evaluateAttack(makeState([phalanx, infantry, archers]), [phalanx, infantry], [archers]);

    // Defense force 1, met by the 5-point infantry alone; the archers are
    // worth 5, so the exchange is a wash rather than a 15-point disaster.
    expect(evaluation.valueByResult.EX).toBe(unitValue(archers) - unitValue(infantry));
  });
});

describe('unitValue', () => {
  it('is the printed cost for a land unit', () => {
    expect(unitValue(makeUnit({ typeId: 'phalanges', position: CENTER }))).toBe(15);
  });

  it('pro-rates a ship by its remaining equipment', () => {
    const galley = makeUnit({ typeId: 'galeres', position: CENTER }); // 10 pts, 2 equipment
    expect(unitValue(galley)).toBe(10);
    galley.equipmentPoints = 1;
    expect(unitValue(galley)).toBe(5);
    galley.equipmentPoints = 0;
    expect(unitValue(galley)).toBe(0);
  });
});

describe('evaluateBoarding', () => {
  it('prices both sides of the boarding table exactly', () => {
    const attacker = makeUnit({ id: 'a', typeId: 'galeres', position: CENTER, owner: 0 });
    const defender = makeUnit({ id: 'd', typeId: 'galeres', position: NEIGHBOR, owner: 1 });

    // Galley vs galley is 10 attack vs 10 defense: the boarding table's 1-1
    // column, which reads (die 1-6) defender-2, defender-1, defender-1,
    // none, attacker-1, attacker-2. Each equipment point is worth 5 of the
    // galley's 10 points.
    const evaluation = evaluateBoarding(attacker, defender);
    expect(evaluation.expectedDefenderLoss).toBeCloseTo(20 / 6, 10);
    expect(evaluation.expectedAttackerLoss).toBeCloseTo(15 / 6, 10);
    expect(evaluation.expectedValue).toBeCloseTo(5 / 6, 10);
    // Only die 1 (-2 equipment) takes a full-strength galley's last point.
    expect(evaluation.sinkChance).toBeCloseTo(1 / 6, 10);
  });

  it('caps damage at what the ship has left, so a crippled ship is not over-valued', () => {
    const attacker = makeUnit({ id: 'a', typeId: 'galeres', position: CENTER, owner: 0 });
    const defender = makeUnit({ id: 'd', typeId: 'galeres', position: NEIGHBOR, owner: 1 });
    defender.equipmentPoints = 1;

    const evaluation = evaluateBoarding(attacker, defender);
    // The defender is now worth 5 points in total, and every losing face
    // sinks it, so its expected loss can't exceed that.
    expect(evaluation.expectedDefenderLoss).toBeLessThanOrEqual(unitValue(defender));
    expect(evaluation.sinkChance).toBeCloseTo(3 / 6, 10);
  });
});

describe('ramming odds', () => {
  it('widens with the bonus exactly as rammingSuccessRange does', () => {
    expect(rammingHitChance('galeres', 'galeres', 0)).toBeCloseTo(1 / 6, 10);
    expect(rammingHitChance('galeres', 'galeres', 1)).toBeCloseTo(2 / 6, 10);
    expect(rammingHitChance('galeres', 'galeres', 2)).toBeCloseTo(3 / 6, 10);
  });

  it('values a ram as the chance of sinking times the target', () => {
    const attacker = makeUnit({ id: 'a', typeId: 'galeres', position: CENTER, owner: 0 });
    const target = makeUnit({ id: 'd', typeId: 'triremes', position: NEIGHBOR, owner: 1 }); // 30 pts
    // galley vs trirème succeeds on 1-2 at full bonus.
    expect(evaluateRam(attacker, target, 2).expectedValue).toBeCloseTo((2 / 6) * 30, 10);
    expect(evaluateRam(attacker, target, 0).expectedValue).toBeCloseTo((1 / 6) * 30, 10);
  });
});
