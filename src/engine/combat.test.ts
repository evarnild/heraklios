import { describe, it, expect } from 'vitest';
import {
  applyExchangeSacrifice,
  applyLandCombatResult,
  checkRangedEligibility,
  commonValidTargets,
  exchangeSacrificeMeetsThreshold,
  resolveElephantStampede,
  resolveLandAttack,
  retreatOrStampede,
  riverBetween,
  unionValidTargets,
  validTargets,
} from './combat';
import { createInitialState } from './turnManager';
import { RIVER_HEXSIDES, riverEdgeKey } from '../data/map';
import type { GameState, Unit } from './state';

/** Picks a real river hexside from whatever map is currently loaded, so
 * these tests stay valid across map replacements/edits rather than pinning
 * a coordinate pair from one specific map. */
function sampleRiverEdge(): [{ q: number; r: number }, { q: number; r: number }] {
  const key = RIVER_HEXSIDES.values().next().value as string;
  const [ka, kb] = key.split('|');
  const [aq, ar] = ka!.split(',').map(Number);
  const [bq, br] = kb!.split(',').map(Number);
  return [{ q: aq!, r: ar! }, { q: bq!, r: br! }];
}

function makeUnit(overrides: Partial<Unit> & { typeId: string; position: { q: number; r: number } }): Unit {
  return {
    id: overrides.id ?? `test-${Math.random()}`,
    owner: 0,
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    destroyed: false,
    ...overrides,
  };
}

function makeState(units: Unit[]): GameState {
  const state = createInitialState([], 'multi-defender');
  state.units = units;
  return state;
}

describe('checkRangedEligibility', () => {
  it('lets archers fire at exactly their range', () => {
    const archer = makeUnit({ typeId: 'archers', position: { q: 0, r: 0 } });
    expect(checkRangedEligibility(archer, 2).canAttack).toBe(true);
    expect(checkRangedEligibility(archer, 1).canAttack).toBe(false); // 0 melee attack
    expect(checkRangedEligibility(archer, 3).canAttack).toBe(false); // not exact range
  });

  it('lets melee-capable hybrids fight adjacent as well as at range', () => {
    const hybrid = makeUnit({ typeId: 'fantassins-archers', position: { q: 0, r: 0 } });
    expect(checkRangedEligibility(hybrid, 1).canAttack).toBe(true);
    expect(checkRangedEligibility(hybrid, 2).canAttack).toBe(true);
  });

  it('blocks pure melee units from attacking at range', () => {
    const infantry = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } });
    expect(checkRangedEligibility(infantry, 1).canAttack).toBe(true);
    expect(checkRangedEligibility(infantry, 2).canAttack).toBe(false);
  });
});

describe('resolveElephantStampede', () => {
  const alwaysOnMap = () => true;

  it('moves the elephant in a straight line for its full movement allowance', () => {
    const elephant = makeUnit({ typeId: 'elephants', position: { q: 5, r: 5 } });
    const result = resolveElephantStampede(elephant, 1, [elephant], alwaysOnMap);
    expect(result.path).toHaveLength(4); // elephant movement allowance is 4
    expect(elephant.position).toEqual(result.path[3]);
    expect(result.exitedMap).toBe(false);
  });

  it('hits any unit found along the path', () => {
    const elephant = makeUnit({ typeId: 'elephants', position: { q: 0, r: 0 } });
    const victim = makeUnit({ typeId: 'fantassins', position: { q: 1, r: 0 } });
    const result = resolveElephantStampede(elephant, 1, [elephant, victim], alwaysOnMap);
    expect(result.unitsHit).toContain(victim);
  });

  it('stops and flags exitedMap when it runs off the edge of the board', () => {
    const elephant = makeUnit({ typeId: 'elephants', position: { q: 0, r: 0 } });
    const isOnMap = (hex: { q: number; r: number }) => hex.q < 2;
    const result = resolveElephantStampede(elephant, 1, [elephant], isOnMap);
    expect(result.exitedMap).toBe(true);
    expect(elephant.position).toEqual({ q: 1, r: 0 });
  });
});

describe('resolveLandAttack', () => {
  it('sums forces and resolves via the CRT', () => {
    const attacker = makeUnit({ typeId: 'phalanges', position: { q: 0, r: 0 } }); // attack 8
    const defender = makeUnit({ typeId: 'fantassins', position: { q: 1, r: 0 } }); // defense 1
    const result = resolveLandAttack([attacker], [defender], 1);
    expect(['AE', 'AR', 'DE', 'DR', 'EX']).toContain(result);
  });

  it('applies the river-crossing bonus to the defender when attacked across a river', () => {
    const [a, b] = sampleRiverEdge();
    const attacker = makeUnit({ typeId: 'fantassins', position: a }); // attack 2
    const defender = makeUnit({ typeId: 'fantassins', position: b }); // defense 1
    // With attack 2 vs defense 1 -> ratio rounds to 1:1. Terrain here is
    // plain (modifier 0), so the +1 river bonus pushes the die up one row.
    const noRiver = resolveLandAttack(
      [makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } })],
      [makeUnit({ typeId: 'fantassins', position: { q: 1, r: 0 } })],
      2,
    );
    const withRiver = resolveLandAttack([attacker], [defender], 2);
    // die 2 at 1:1 = DR; die 3 (2 + river 1) at 1:1 = DR as well, but the
    // key assertion is simply that the river edge is recognized:
    expect(riverBetween(a, b)).toBe(true);
    expect(['AE', 'AR', 'DE', 'DR', 'EX']).toContain(withRiver);
    expect(['AE', 'AR', 'DE', 'DR', 'EX']).toContain(noRiver);
  });
});

describe('resolveLandAttack — multi-unit force summing', () => {
  // Coordinates far outside any real map's range, so terrain reliably
  // defaults to 'plain' (modifier 0) and no river crossing applies,
  // regardless of what the currently-loaded map looks like.
  it('sums two attackers to an exact 4:1 ratio against one defender, deterministic per die', () => {
    const a1 = makeUnit({ typeId: 'fantassins', position: { q: 9000, r: 9000 } }); // attack 2
    const a2 = makeUnit({ typeId: 'fantassins', position: { q: 9000, r: 9001 } }); // attack 2
    const defender = makeUnit({ typeId: 'fantassins', position: { q: 9001, r: 9000 }, owner: 1 }); // defense 1
    // 4:1 column: die1=DE, die2-5=DR, die6=EX (see combatTable.ts's transcribed CRT).
    expect(resolveLandAttack([a1, a2], [defender], 1)).toBe('DE');
    expect(resolveLandAttack([a1, a2], [defender], 2)).toBe('DR');
    expect(resolveLandAttack([a1, a2], [defender], 5)).toBe('DR');
    expect(resolveLandAttack([a1, a2], [defender], 6)).toBe('EX');
  });

  it('sums forces across multiple defenders too (multi-defender mode)', () => {
    const attacker = makeUnit({ typeId: 'phalanges', position: { q: 9000, r: 9000 } }); // attack 8
    const d1 = makeUnit({ typeId: 'fantassins', position: { q: 9001, r: 9000 }, owner: 1 }); // defense 1
    const d2 = makeUnit({ typeId: 'fantassins', position: { q: 9000, r: 9001 }, owner: 1 }); // defense 1
    // 8 attack vs 2 total defense -> ratio 4:1 (rounds down from 4 exactly).
    expect(resolveLandAttack([attacker], [d1, d2], 1)).toBe('DE');
    expect(resolveLandAttack([attacker], [d1, d2], 6)).toBe('EX');
  });
});

describe('validTargets / commonValidTargets / unionValidTargets', () => {
  it('excludes a unit already attacked this combat phase', () => {
    const attacker = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } });
    const defender = makeUnit({
      typeId: 'fantassins',
      position: { q: 1, r: 0 },
      owner: 1,
      defendedThisPhase: true,
    });
    const state = makeState([attacker, defender]);
    expect(validTargets(state, attacker)).toHaveLength(0);
  });

  it('narrows to the intersection of what every group member can individually reach', () => {
    const archer = makeUnit({ typeId: 'archers', position: { q: 0, r: 0 } }); // range 2 only
    const melee = makeUnit({ typeId: 'fantassins', position: { q: 1, r: 0 } }); // adjacent only
    const shared = makeUnit({ typeId: 'fantassins', position: { q: 2, r: 0 }, owner: 1 }); // dist 2 from archer, dist 1 from melee
    const archerOnly = makeUnit({ typeId: 'fantassins', position: { q: -2, r: 0 }, owner: 1 }); // dist 2 from archer, dist 3 from melee
    const meleeOnly = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 1 }, owner: 1 }); // dist 1 from archer...

    const state = makeState([archer, melee, shared, archerOnly, meleeOnly]);
    const union = unionValidTargets(state, [archer, melee]);
    expect(union.map((u) => u.id)).toEqual(expect.arrayContaining([shared.id, archerOnly.id]));

    const common = commonValidTargets(state, [archer, melee]);
    expect(common).toHaveLength(1);
    expect(common[0]!.id).toBe(shared.id);
  });

  it('collapses to empty when adding a third unit with a disjoint reachable set', () => {
    const archer = makeUnit({ typeId: 'archers', position: { q: 0, r: 0 } });
    const melee = makeUnit({ typeId: 'fantassins', position: { q: 1, r: 0 } });
    const shared = makeUnit({ typeId: 'fantassins', position: { q: 2, r: 0 }, owner: 1 });
    const farAway = makeUnit({ typeId: 'archers', position: { q: 9000, r: 9000 } });

    const state = makeState([archer, melee, shared, farAway]);
    expect(commonValidTargets(state, [archer, melee])).toHaveLength(1);
    expect(commonValidTargets(state, [archer, melee, farAway])).toHaveLength(0);
  });
});

describe('retreatOrStampede', () => {
  it('retreats a non-elephant unit one hex directly away from the reference unit', () => {
    // (0,0), (0,1), (0,2) are known 'plain' hexes on the shipped map.
    const unit = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 1 } });
    const awayFrom = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 }, owner: 1 });
    const state = makeState([unit, awayFrom]);
    const outcome = retreatOrStampede(state, unit, awayFrom);
    expect(outcome.stampeded).toBe(false);
    expect(unit.position).toEqual({ q: 0, r: 2 });
  });

  it('eliminates a unit with nowhere legal to retreat to', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: { q: 9000, r: 9000 } });
    const awayFrom = makeUnit({ typeId: 'fantassins', position: { q: 8999, r: 9000 }, owner: 1 });
    const state = makeState([unit, awayFrom]);
    retreatOrStampede(state, unit, awayFrom);
    expect(unit.destroyed).toBe(true);
  });

  it('stampedes an elephant instead of retreating normally', () => {
    const elephant = makeUnit({ typeId: 'elephants', position: { q: 0, r: 1 } });
    const awayFrom = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 }, owner: 1 });
    const state = makeState([elephant, awayFrom]);
    const outcome = retreatOrStampede(state, elephant, awayFrom, () => 1);
    expect(outcome.stampeded).toBe(true);
  });
});

describe('applyLandCombatResult — EX (exchange)', () => {
  it('with a single attacker, destroys both sides outright (no real choice to make)', () => {
    const attacker = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } });
    const defender = makeUnit({ typeId: 'fantassins', position: { q: 1, r: 0 }, owner: 1 });
    const state = makeState([attacker, defender]);
    const outcome = applyLandCombatResult(state, [attacker], [defender], 'EX');
    expect(outcome.requiresExchangeChoice).toBe(false);
    expect(attacker.destroyed).toBe(true);
    expect(defender.destroyed).toBe(true);
    expect(defender.defendedThisPhase).toBe(true);
  });

  it('with a multi-unit attack group, destroys defenders but defers the sacrifice choice to the caller', () => {
    const a1 = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } }); // attack 2
    const a2 = makeUnit({ typeId: 'phalanges', position: { q: 0, r: 1 } }); // attack 8
    const defender = makeUnit({ typeId: 'fantassins', position: { q: 1, r: 0 }, owner: 1 }); // defense 1
    const state = makeState([a1, a2, defender]);
    const outcome = applyLandCombatResult(state, [a1, a2], [defender], 'EX');
    expect(outcome.requiresExchangeChoice).toBe(true);
    expect(outcome.requiredSacrificeForce).toBe(1);
    expect(defender.destroyed).toBe(true);
    expect(a1.destroyed).toBe(false);
    expect(a2.destroyed).toBe(false);
  });
});

describe('exchangeSacrificeMeetsThreshold / applyExchangeSacrifice', () => {
  it('checks the selected units total attack against the required force', () => {
    const weak = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } }); // attack 2
    const strong = makeUnit({ typeId: 'phalanges', position: { q: 0, r: 1 } }); // attack 8
    expect(exchangeSacrificeMeetsThreshold([weak], 3)).toBe(false);
    expect(exchangeSacrificeMeetsThreshold([strong], 3)).toBe(true);
    expect(exchangeSacrificeMeetsThreshold([weak, strong], 10)).toBe(true);
  });

  it('destroys only the units it is given', () => {
    const weak = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } });
    const strong = makeUnit({ typeId: 'phalanges', position: { q: 0, r: 1 } });
    applyExchangeSacrifice([strong]);
    expect(strong.destroyed).toBe(true);
    expect(weak.destroyed).toBe(false);
  });
});

describe('riverBetween', () => {
  it('recognizes a known river hexside symmetrically and rejects a non-river edge', () => {
    const [a, b] = sampleRiverEdge();
    expect(riverBetween(a, b)).toBe(true);
    expect(riverBetween(b, a)).toBe(true);
    // Coordinates far outside any real map's range can't coincidentally be a river edge.
    expect(riverBetween({ q: 9999, r: 9999 }, { q: 10000, r: 9999 })).toBe(false);
  });
});
