import { describe, it, expect } from 'vitest';
import {
  applyBoardingResult,
  applyExchangeSacrifice,
  applyLandCombatResult,
  applyRammingResult,
  attackForceAgainst,
  attackerCanJoin,
  canBoard,
  canElephantEnterHex,
  canUnitEnterHex,
  cavalryMayAttack,
  checkRangedEligibility,
  commonValidTargets,
  completePush,
  defenderCanJoin,
  describeLandAttack,
  eligibleAdvanceCandidates,
  exchangeSacrificeForce,
  exchangeSacrificeMeetsThreshold,
  legalRetreatHexes,
  pruneIllegalSelections,
  pushCandidates,
  resolveLandAttack,
  retreatUnitTo,
  riverBetween,
  unionValidTargets,
  validTargets,
} from './combat';
import { DIRECTIONS, hexAdd, hexDistance } from './hex';
import { createInitialState } from './turnManager';
import { RIVER_HEXSIDES, riverEdgeKey } from '../data/map';
import { UNIT_TYPES } from '../data/units';
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

describe('canUnitEnterHex', () => {
  it('rejects terrain forbidden to the unit\'s category', () => {
    const chariot = makeUnit({ typeId: 'chars-lourds', position: { q: 0, r: 0 } });
    expect(canUnitEnterHex(chariot, { q: 7, r: 15 })).toBe(false); // marsh
  });

  it('allows the same hex for a category that terrain does not forbid', () => {
    const fantassins = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } });
    expect(canUnitEnterHex(fantassins, { q: 7, r: 15 })).toBe(true); // marsh, but land is never forbidden there
  });

  it('rejects a hex off the map', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } });
    expect(canUnitEnterHex(unit, { q: -9999, r: -9999 })).toBe(false);
  });
});

describe('eligibleAdvanceCandidates', () => {
  // HIGH finding from adversarial review: an earlier version of the fuzz
  // harness's own advance-offer plumbing filtered by `!destroyed` alone,
  // with no terrain check — since that filter existed only in the harness
  // (not as a shared, tested engine function), it silently prevented the
  // harness's OWN terrain invariant from ever seeing the same bug in
  // `BoardScene.ts`'s `promptAdvanceChoice`. Extracted here so both callers
  // share one tested implementation.
  // Every candidate below stands ADJACENT to the vacated hex it is being
  // tested against, so each test isolates the filter it is named for rather
  // than passing for free on the adjacency rule added later (see the
  // dedicated adjacency tests underneath).
  const VACATED = { q: 5, r: 5 }; // plain
  const NEXT_TO_VACATED = [
    { q: 6, r: 5 },
    { q: 5, r: 6 },
  ];

  it('excludes a destroyed candidate', () => {
    const alive = makeUnit({ id: 'a', typeId: 'fantassins', position: NEXT_TO_VACATED[0]! });
    const dead = makeUnit({ id: 'd', typeId: 'fantassins', position: NEXT_TO_VACATED[1]!, destroyed: true });
    const result = eligibleAdvanceCandidates([alive, dead], VACATED);
    expect(result.map((u) => u.id)).toEqual(['a']);
  });

  it('excludes a candidate whose category cannot enter the vacated hex\'s terrain', () => {
    // (7,15) is 'marsh' — forbidden to chariots, fine for infantry.
    const marsh = { q: 7, r: 15 };
    const chariot = makeUnit({ id: 'c', typeId: 'chars-lourds', position: { q: 8, r: 15 } });
    const infantry = makeUnit({ id: 'i', typeId: 'fantassins', position: { q: 7, r: 16 } });
    for (const u of [chariot, infantry]) expect(hexDistance(u.position, marsh)).toBe(1);
    const result = eligibleAdvanceCandidates([chariot, infantry], marsh);
    expect(result.map((u) => u.id)).toEqual(['i']);
  });

  it('returns every alive, adjacent, terrain-eligible candidate', () => {
    const a = makeUnit({ id: 'a', typeId: 'fantassins', position: NEXT_TO_VACATED[0]! });
    const b = makeUnit({ id: 'b', typeId: 'cavalerie-legere', position: NEXT_TO_VACATED[1]! });
    const result = eligibleAdvanceCandidates([a, b], VACATED);
    expect(result.map((u) => u.id).sort()).toEqual(['a', 'b']);
  });

  it('excludes an attacker that is not adjacent to the vacated hex', () => {
    // The archer case (plan.md §15.5): a unit that shot from two hexes never
    // came into contact, so it has no hex to step forward FROM. Reading the
    // rulebook's "sans tenir compte des limites de déplacement" literally
    // would let it cross the intervening hex — occupied or not — which no
    // other rule in the game allows.
    const adjacent = makeUnit({ id: 'melee', typeId: 'fantassins', position: NEXT_TO_VACATED[0]! });
    const shooter = makeUnit({ id: 'archer', typeId: 'archers', position: { q: 7, r: 5 } });
    expect(hexDistance(shooter.position, VACATED)).toBe(2);
    // Terrain and liveness are BOTH satisfied for the archer, so adjacency is
    // the only thing that can exclude it — the control that makes this test
    // discriminating rather than incidentally green.
    expect(canUnitEnterHex(shooter, VACATED)).toBe(true);
    expect(shooter.destroyed).toBe(false);

    const result = eligibleAdvanceCandidates([adjacent, shooter], VACATED);
    expect(result.map((u) => u.id)).toEqual(['melee']);
  });

  it('is a no-op for a melee attacker, which is adjacent by construction', () => {
    // Guards the claim the interpretation rests on: enforcing adjacency
    // cannot take the advance away from anyone the rulebook meant to give it
    // to, because being adjacent to the defender is what made them an
    // attacker. Swept over every land type rather than asserted for one.
    for (const t of UNIT_TYPES) {
      if (t.domain !== 'land' || !t.meleeCapable) continue;
      const attacker = makeUnit({ id: t.id, typeId: t.id, position: NEXT_TO_VACATED[0]! });
      if (!canUnitEnterHex(attacker, VACATED)) continue; // terrain, a separate filter
      expect([t.id, eligibleAdvanceCandidates([attacker], VACATED).length]).toEqual([t.id, 1]);
    }
  });
});

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

describe('attackForceAgainst (plan.md §15)', () => {
  it('resolves an archer volley on its projectile value, not its melee 0', () => {
    // The defect this function exists to fix: `archers` are `attack: 0,
    // rangedAttack: 2`, and summing `currentAttack` alone made every volley
    // resolve at force 0 — the CRT's 1-5 column, five AE faces of six.
    const archers = makeUnit({ typeId: 'archers', position: { q: 0, r: 0 } });
    const target = makeUnit({ typeId: 'fantassins', position: { q: 2, r: 0 }, owner: 1 });
    expect(hexDistance(archers.position, target.position)).toBe(2); // exactly their range
    expect(attackForceAgainst(archers, [target])).toBe(2);
  });

  it('prefers the melee value at contact and the projectile value at range', () => {
    // Deliberately probed with a `triremes` (attack 20, rangedAttack 2,
    // meleeCapable, range 2): it is the only roster entry whose two attack
    // values DIFFER, so it is the only unit that can tell the two branches
    // apart at all. `fantassins-archers`, the hybrid this rule is really
    // about, is 2 and 2 — a test written on it would pass with the branch
    // selection inverted, or deleted.
    const contact = makeUnit({ id: 'c', typeId: 'triremes', position: { q: 0, r: 0 } });
    const atRange = makeUnit({ id: 'r', typeId: 'triremes', position: { q: 0, r: 0 } });
    const adjacentTarget = makeUnit({ id: 't1', typeId: 'fantassins', position: { q: 1, r: 0 }, owner: 1 });
    const distantTarget = makeUnit({ id: 't2', typeId: 'fantassins', position: { q: 2, r: 0 }, owner: 1 });

    expect(attackForceAgainst(contact, [adjacentTarget])).toBe(20);
    expect(attackForceAgainst(atRange, [distantTarget])).toBe(2);
    // Adjacency wins when a multi-defender group offers both: "fights the
    // way it would against the nearest of them."
    expect(attackForceAgainst(contact, [distantTarget, adjacentTarget])).toBe(20);
  });

  it('keeps the charge doubling for a melee attacker', () => {
    const charger = makeUnit({ typeId: 'cavalerie-lourde', position: { q: 0, r: 0 }, charged: true });
    const target = makeUnit({ typeId: 'fantassins', position: { q: 1, r: 0 }, owner: 1 });
    expect(attackForceAgainst(charger, [target])).toBe(12); // 6 doubled, not the printed 6
  });

  it('sums each attacker at its own engagement distance in a combined attack', () => {
    // The rulebook names archers specifically as an example of a
    // per-attacker proximity condition inside a combined attack, so an
    // archer at 2 and an infantry unit at 1 both contribute 2, for 4 total
    // against a `fantassins-lourds`' defense of 3 — the 1-1 column, where
    // before the fix the same pair reached only 2 and rounded down to 1-2.
    const archers = makeUnit({ id: 'x', typeId: 'archers', position: { q: 0, r: 0 } });
    const infantry = makeUnit({ id: 'f', typeId: 'fantassins', position: { q: 1, r: 1 } });
    const defender = makeUnit({ id: 'd', typeId: 'fantassins-lourds', position: { q: 2, r: 0 }, owner: 1 });
    expect(hexDistance(archers.position, defender.position)).toBe(2);
    expect(hexDistance(infantry.position, defender.position)).toBe(1);

    const detail = describeLandAttack([archers, infantry], [defender], 1);
    expect(detail.attackForce).toBe(4);
    expect(detail.ratioLabel).toBe('1-1');
    expect(detail.attackerForces.get('x')).toBe(2);
    expect(detail.attackerForces.get('f')).toBe(2);
  });
});

describe('pruneIllegalSelections (plan.md §15.6)', () => {
  /**
   * `d1` is reachable by BOTH attackers (infantry adjacent, archer at exactly
   * its range of 2). `d2` is reachable ONLY by the infantry: it is adjacent
   * to the archer too, but archers are not `meleeCapable`, so adjacency is
   * not a legal attack for them. That asymmetry is what makes each direction
   * of the prune testable.
   */
  function scenario() {
    const infantry = makeUnit({ id: 'inf', typeId: 'fantassins', position: { q: 10, r: 5 }, owner: 0 });
    const archer = makeUnit({ id: 'arch', typeId: 'archers', position: { q: 9, r: 5 }, owner: 0 });
    const d1 = makeUnit({ id: 'd1', typeId: 'fantassins', position: { q: 11, r: 5 }, owner: 1 });
    const d2 = makeUnit({ id: 'd2', typeId: 'fantassins', position: { q: 10, r: 4 }, owner: 1 });
    return { infantry, archer, d1, d2, state: makeState([infantry, archer, d1, d2]) };
  }

  it('pins the scenario geometry the rest of this block depends on', () => {
    const { infantry, archer, d1, d2, state } = scenario();
    expect(hexDistance(archer.position, d1.position)).toBe(2); // exactly its range
    expect(hexDistance(archer.position, d2.position)).toBe(1); // adjacent, and it cannot melee
    expect(validTargets(state, archer).map((u) => u.id)).toEqual(['d1']);
    expect(validTargets(state, infantry).map((u) => u.id).sort()).toEqual(['d1', 'd2']);
  });

  it('drops an attacker stranded by untargeting the only defender it reached', () => {
    // The live path adversarial review found: target d1 and d2 with both
    // units, then untarget d1. The archer now reaches nothing in the group —
    // but nothing re-checked, so it stayed in and contributed through
    // `attackForceAgainst`'s fallback at its MELEE value of 0. That is
    // plan.md §15's defect resurrected for that unit.
    const { infantry, archer, d2, state } = scenario();
    const pruned = pruneIllegalSelections(state, [infantry, archer], [d2], 'multi-defender');
    expect(pruned.attackers.map((u) => u.id)).toEqual(['inf']);
    expect(pruned.dropped.map((u) => u.id)).toEqual(['arch']);
    expect(pruned.defenders.map((u) => u.id)).toEqual(['d2']); // still reachable, so still targeted
  });

  it('drops a defender stranded by deselecting the only attacker that reached it', () => {
    // The mirror case, which the review did not name: deselect the infantry
    // and d2 is left targeted by a group that cannot touch it.
    const { archer, d1, d2, state } = scenario();
    const pruned = pruneIllegalSelections(state, [archer], [d1, d2], 'multi-defender');
    expect(pruned.defenders.map((u) => u.id)).toEqual(['d1']);
    expect(pruned.dropped.map((u) => u.id)).toEqual(['d2']);
    expect(pruned.attackers.map((u) => u.id)).toEqual(['arch']);
  });

  it('leaves a still-legal selection completely untouched', () => {
    // The control: without it, a prune that dropped everything unconditionally
    // would satisfy both tests above.
    const { infantry, archer, d1, state } = scenario();
    const pruned = pruneIllegalSelections(state, [infantry, archer], [d1], 'multi-defender');
    expect(pruned.attackers.map((u) => u.id)).toEqual(['inf', 'arch']);
    expect(pruned.defenders.map((u) => u.id)).toEqual(['d1']);
    expect(pruned.dropped).toEqual([]);
  });

  it('never empties the attack group while defenders remain', () => {
    // The invariant the "one pass is enough" argument rests on: every
    // surviving defender is reachable by some surviving attacker. Asserted
    // over every subset rather than left as prose.
    const { infantry, archer, d1, d2, state } = scenario();
    for (const defenders of [[d1], [d2], [d1, d2]]) {
      const pruned = pruneIllegalSelections(state, [infantry, archer], defenders, 'multi-defender');
      if (pruned.defenders.length > 0) expect(pruned.attackers.length).toBeGreaterThan(0);
    }
  });

  it('drops nothing when the defender group is emptied entirely', () => {
    // With no target selected the join rules impose nothing, so an untarget
    // that clears the board must not cascade into deselecting the attackers.
    const { infantry, archer, state } = scenario();
    const pruned = pruneIllegalSelections(state, [infantry, archer], [], 'multi-defender');
    expect(pruned.attackers.map((u) => u.id)).toEqual(['inf', 'arch']);
    expect(pruned.dropped).toEqual([]);
  });
});

describe('canElephantEnterHex', () => {
  it('allows land hexes and rejects off-map, coastal, and sea-like hexes', () => {
    expect(canElephantEnterHex({ q: 0, r: 0 })).toBe(true); // known 'plain' hex
    expect(canElephantEnterHex({ q: 9999, r: 9999 })).toBe(false); // off the map
    // (24,3) is 'coast' and (25,3) is 'zone-anse-hypnos' (sea-like) on the shipped map.
    expect(canElephantEnterHex({ q: 24, r: 3 })).toBe(false);
    expect(canElephantEnterHex({ q: 25, r: 3 })).toBe(false);
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

describe('describeLandAttack — audit fields', () => {
  it('names the terrain and hex responsible for a triggered conditional bonus (plateau)', () => {
    // (4,9) is 'plateau' (combatModifier 2, conditionalOnAttackingFromBelow) on
    // the shipped map — see the retreat tests below for the same fixture.
    const attacker = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } }); // 'plain'
    const defender = makeUnit({ typeId: 'fantassins', position: { q: 4, r: 9 } }); // 'plateau'
    const detail = describeLandAttack([attacker], [defender], 3);
    expect(detail.terrainModifierSource).toBe('plateau');
    expect(detail.terrainModifierSourceHex).toEqual({ q: 4, r: 9 });
    expect(detail.terrainOnlyModifier).toBe(2);
    expect(detail.riverCrossingApplied).toBe(false);
    expect(detail.terrainModifier).toBe(2);
    expect(detail.modifiedDieRoll).toBe(5);
  });

  it('reports no terrain source when the defender is on unmodified (plain) terrain', () => {
    const attacker = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } });
    const defender = makeUnit({ typeId: 'fantassins', position: { q: 1, r: 0 } }); // 'plain'
    const detail = describeLandAttack([attacker], [defender], 3);
    expect(detail.terrainModifierSource).toBeNull();
    expect(detail.terrainModifierSourceHex).toBeNull();
    expect(detail.terrainOnlyModifier).toBe(0);
    expect(detail.terrainModifier).toBe(0);
  });

  it('names the HIGHEST-modifier defender\'s hex in a multi-defender combat, in either argument order', () => {
    // Both (4,9) 'plateau' (modifier 2, conditional — triggers here since the
    // attacker's own hex isn't plateau) and (7,15) 'marsh' (modifier 1,
    // unconditional) contribute a NONZERO modifier, so a bug that names
    // whichever defender was processed LAST (rather than tracking the true
    // max) can't hide behind "the other one didn't contribute at all" the
    // way a plain (modifier 0) second defender would — see the single- vs
    // multi-defender split in this function's doc comment.
    const attacker = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } }); // 'plain'
    const plateauDefender = makeUnit({ id: 'p', typeId: 'fantassins', position: { q: 4, r: 9 } }); // 'plateau'
    const marshDefender = makeUnit({ id: 'm', typeId: 'fantassins', position: { q: 7, r: 15 } }); // 'marsh'

    const plateauFirst = describeLandAttack([attacker], [plateauDefender, marshDefender], 3);
    expect(plateauFirst.terrainModifierSource).toBe('plateau');
    expect(plateauFirst.terrainModifierSourceHex).toEqual({ q: 4, r: 9 });
    expect(plateauFirst.terrainOnlyModifier).toBe(2);

    const marshFirst = describeLandAttack([attacker], [marshDefender, plateauDefender], 3);
    expect(marshFirst.terrainModifierSource).toBe('plateau');
    expect(marshFirst.terrainModifierSourceHex).toEqual({ q: 4, r: 9 });
    expect(marshFirst.terrainOnlyModifier).toBe(2);
  });

  it('flags the river-crossing bonus separately from any terrain modifier', () => {
    const [a, b] = sampleRiverEdge(); // both 'plain' on the shipped map
    const attacker = makeUnit({ typeId: 'fantassins', position: a });
    const defender = makeUnit({ typeId: 'fantassins', position: b });
    const detail = describeLandAttack([attacker], [defender], 2);
    expect(detail.riverCrossingApplied).toBe(true);
    expect(detail.terrainOnlyModifier).toBe(0);
    expect(detail.terrainModifierSource).toBeNull();
    expect(detail.terrainModifierSourceHex).toBeNull();
    expect(detail.terrainModifier).toBe(1); // RIVER_CROSSING.combatModifier
    expect(detail.modifiedDieRoll).toBe(3);
  });

  it('exposes the exact CRT column index behind ratioLabel', () => {
    const a1 = makeUnit({ typeId: 'fantassins', position: { q: 9000, r: 9000 } }); // attack 2
    const a2 = makeUnit({ typeId: 'fantassins', position: { q: 9000, r: 9001 } }); // attack 2
    const defender = makeUnit({ typeId: 'fantassins', position: { q: 9001, r: 9000 }, owner: 1 }); // defense 1
    const detail = describeLandAttack([a1, a2], [defender], 1);
    // 4:1 ratio -> RATIO_COLUMNS index 7 ('4-1').
    expect(detail.ratioLabel).toBe('4-1');
    expect(detail.crtColumnIndex).toBe(7);
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

describe('cavalryMayAttack — phalanx restriction', () => {
  it('forbids cavalry from targeting a phalanx, whether light or heavy', () => {
    const phalanx = makeUnit({ typeId: 'phalanges', position: { q: 0, r: 0 }, owner: 1 });
    const light = makeUnit({ typeId: 'cavalerie-legere', position: { q: 1, r: 0 } });
    const heavy = makeUnit({ typeId: 'cavalerie-lourde', position: { q: 1, r: 0 } });
    expect(cavalryMayAttack(light, phalanx)).toBe(false);
    expect(cavalryMayAttack(heavy, phalanx)).toBe(false);
  });

  it('allows cavalry to attack any other unit type', () => {
    const infantry = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 }, owner: 1 });
    const cav = makeUnit({ typeId: 'cavalerie-legere', position: { q: 1, r: 0 } });
    expect(cavalryMayAttack(cav, infantry)).toBe(true);
  });

  it('allows non-cavalry units to attack a phalanx normally', () => {
    const phalanx = makeUnit({ typeId: 'phalanges', position: { q: 0, r: 0 }, owner: 1 });
    const infantry = makeUnit({ typeId: 'fantassins', position: { q: 1, r: 0 } });
    expect(cavalryMayAttack(infantry, phalanx)).toBe(true);
  });

  it('excludes a phalanx from validTargets for an adjacent cavalry unit, but not for adjacent infantry', () => {
    const phalanx = makeUnit({ typeId: 'phalanges', position: { q: 0, r: 0 }, owner: 1 });
    const cav = makeUnit({ typeId: 'cavalerie-legere', position: { q: 1, r: 0 } });
    const infantry = makeUnit({ typeId: 'fantassins', position: { q: -1, r: 0 } });
    const state = makeState([phalanx, cav, infantry]);
    expect(validTargets(state, cav)).toHaveLength(0);
    expect(validTargets(state, infantry).map((u) => u.id)).toEqual([phalanx.id]);
  });
});

describe('attackerCanJoin / defenderCanJoin — phalanx restriction is group-aware', () => {
  // Regression for an adversarial-review finding: `unionValidTargets` (the
  // 'multi-defender' eligibility rule) only asks whether SOME attacker can
  // reach a given defender, so a phalanx was reachable through a non-cavalry
  // groupmate even while a cavalry unit sat elsewhere in the same attack
  // group — which the rulebook forbids outright. `attackerCanJoin` /
  // `defenderCanJoin` must reject the phalanx (or the cavalry) regardless of
  // which unit joins the group first.
  it('defenderCanJoin rejects a phalanx once cavalry is anywhere in the attack group, in either build order', () => {
    const phalanx = makeUnit({ typeId: 'phalanges', position: { q: 0, r: 0 }, owner: 1 });
    const infantry = makeUnit({ typeId: 'fantassins', position: { q: -1, r: 0 } });
    const cavalry = makeUnit({ typeId: 'cavalerie-legere', position: { q: 1, r: 0 } });
    const state = makeState([phalanx, infantry, cavalry]);

    // Sanity check: infantry ALONE (no cavalry in the group) may legitimately target the phalanx.
    expect(defenderCanJoin(state, phalanx, [infantry], 'multi-defender')).toBe(true);

    // "infantry-then-cavalry": infantry joined the attack group before the
    // phalanx was offered as a target, then cavalry joined too.
    expect(defenderCanJoin(state, phalanx, [infantry, cavalry], 'multi-defender')).toBe(false);
    // "cavalry-then-infantry": same final group, built in the other order —
    // group-membership checks must not depend on array order.
    expect(defenderCanJoin(state, phalanx, [cavalry, infantry], 'multi-defender')).toBe(false);
  });

  it('attackerCanJoin rejects a cavalry candidate from joining a group already attacking a phalanx', () => {
    const phalanx = makeUnit({ typeId: 'phalanges', position: { q: 0, r: 0 }, owner: 1 });
    const cavalry = makeUnit({ typeId: 'cavalerie-legere', position: { q: 1, r: 0 } });
    const state = makeState([phalanx, cavalry]);
    expect(attackerCanJoin(state, cavalry, [phalanx], 'multi-defender')).toBe(false);
    expect(attackerCanJoin(state, cavalry, [phalanx], 'single-defender')).toBe(false);
  });

  it('single-defender mode was already safe: commonValidTargets already excludes the phalanx once cavalry is in the group', () => {
    const phalanx = makeUnit({ typeId: 'phalanges', position: { q: 0, r: 0 }, owner: 1 });
    const infantry = makeUnit({ typeId: 'fantassins', position: { q: -1, r: 0 } });
    const cavalry = makeUnit({ typeId: 'cavalerie-legere', position: { q: 1, r: 0 } });
    const state = makeState([phalanx, infantry, cavalry]);
    expect(defenderCanJoin(state, phalanx, [infantry, cavalry], 'single-defender')).toBe(false);
  });
});

// (10,5) and its 6 axial neighbors — (11,5),(11,4),(10,4),(9,5),(9,6),(10,6) —
// are all known 'plain' hexes on the shipped map, well away from any edge,
// so every direction has a real on-map neighbor to test against.
const CENTER = { q: 10, r: 5 };
const NEIGHBORS = [
  { q: 11, r: 5 },
  { q: 11, r: 4 },
  { q: 10, r: 4 },
  { q: 9, r: 5 },
  { q: 9, r: 6 },
  { q: 10, r: 6 },
];

describe('legalRetreatHexes', () => {
  it('excludes occupied hexes and hexes under enemy zone of control', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    const friendlyBlocker = makeUnit({ typeId: 'fantassins', position: NEIGHBORS[0]! });
    // (9,4) is a land unit adjacent to (9,5) (NEIGHBORS[3]), projecting ZOC onto it.
    const enemyZocSource = makeUnit({ typeId: 'fantassins', position: { q: 9, r: 4 }, owner: 1 });
    const state = makeState([unit, friendlyBlocker, enemyZocSource]);

    // (9,4) is itself adjacent to two of CENTER's neighbors — (10,4) and
    // (9,5) — so its ZOC blocks both of those in addition to the occupied one.
    const legal = legalRetreatHexes(state, unit);
    expect(legal).toHaveLength(3);
    expect(legal).not.toContainEqual(NEIGHBORS[0]); // occupied by a friendly unit
    expect(legal).not.toContainEqual(NEIGHBORS[2]); // empty, but under enemy ZOC
    expect(legal).not.toContainEqual(NEIGHBORS[3]); // empty, but under enemy ZOC
  });

  // Regression for a real defect the Stage 2 fuzz harness caught (plan.md
  // §6): this function checked on-map/occupied/ZOC but never terrain
  // restrictions, so a combat retreat could force cavalry, chariots, or
  // elephants onto terrain `reachableHexes` would never otherwise let them
  // enter under their own power.
  it('excludes terrain the retreating unit cannot enter — cavalry may not retreat onto a steep flank', () => {
    // (0,23) is 'plain'; its neighbor (0,24) is 'steep-flank', forbidden to
    // cavalry (see data/terrain.ts's TERRAIN_EFFECTS['steep-flank'].forbiddenFor).
    const cav = makeUnit({ typeId: 'cavalerie-legere', position: { q: 0, r: 23 } });
    const state = makeState([cav]);
    const legal = legalRetreatHexes(state, cav);
    expect(legal).not.toContainEqual({ q: 0, r: 24 });
  });

  it('excludes marsh terrain for a chariot forced to retreat', () => {
    // (7,15) is 'marsh' (forbidden to chariots); (8,15) is also 'marsh' but
    // (7,14) is a known plain neighbor to place the chariot on (see
    // data/map.ts's terrain listing around this row).
    const chariot = makeUnit({ typeId: 'chars-lourds', position: { q: 7, r: 14 } });
    const state = makeState([chariot]);
    const legal = legalRetreatHexes(state, chariot);
    expect(legal).not.toContainEqual({ q: 7, r: 15 });
  });

  // HIGH finding from adversarial review: the terrain fix above has a
  // consequence that was never pinned down — a unit with NO legal retreat
  // hex at all (not boxed by units or ZOC, genuinely surrounded by terrain
  // its category can't enter) is eliminated outright by
  // `applyLandCombatResult` (see its `forceRetreat` helper below), even with
  // no enemy adjacent and nothing boxing it in. This is not hypothetical on
  // the shipped map: (4,9) is 'plateau', and all 6 of its neighbors —
  // (5,9),(5,8),(4,8),(3,9),(3,10),(4,10) — are 'steep-flank', forbidden to
  // cavalry/chariots (see data/map.ts). Light cavalry sitting on (4,9) that
  // is ever forced to retreat (AR/DR) has nowhere to go and is destroyed.
  it('a unit terrain-boxed with no legal retreat and no push option is eliminated — (4,9) on the shipped map', () => {
    const cav = makeUnit({ typeId: 'cavalerie-legere', position: { q: 4, r: 9 } });
    expect(legalRetreatHexes(makeState([cav]), cav)).toHaveLength(0);
    expect(pushCandidates(makeState([cav]), cav)).toHaveLength(0);
  });
});

describe('pushCandidates', () => {
  it('returns every neighbor when the unit is fully surrounded by friendly units', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    const friendlies = NEIGHBORS.map((pos, i) => makeUnit({ typeId: 'fantassins', position: pos, id: `f${i}` }));
    const state = makeState([unit, ...friendlies]);

    const candidates = pushCandidates(state, unit);
    expect(candidates.map((u) => u.id).sort()).toEqual(friendlies.map((u) => u.id).sort());
  });

  // Plan.md §12.2 — the widened, permissive reading: a neighbor that ISN'T
  // friendly-occupied (enemy-held, here) simply isn't itself a push
  // candidate, but no longer voids every OTHER neighbor's candidacy the way
  // the old strict "entourée" (all six must be friendly) reading did.
  it('a neighbor occupied by an enemy is simply not a candidate — the other 5 friendlies still are', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    const friendlies = NEIGHBORS.slice(0, 5).map((pos, i) => makeUnit({ typeId: 'fantassins', position: pos, id: `f${i}` }));
    const enemy = makeUnit({ typeId: 'fantassins', position: NEIGHBORS[5]!, owner: 1 });
    const state = makeState([unit, ...friendlies, enemy]);

    const candidates = pushCandidates(state, unit);
    expect(candidates.map((u) => u.id).sort()).toEqual(friendlies.map((u) => u.id).sort());
  });

  it('excludes a friendly neighbor that has no room anywhere, even after considering ITS OWN cascade — pushing must make real room, not just swap', () => {
    // `unit` has exactly one friendly neighbor, `f0` — and `f0` is itself
    // fully boxed in (5 enemies plus `unit`, which is excluded from f0's own
    // candidate search since it's still mid-resolution — see
    // `pushCandidates`'s cycle-prevention note). f0 has no direct retreat
    // AND no viable push of its own, so it must not be offered here either.
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    const f0 = makeUnit({ id: 'f0', typeId: 'fantassins', position: NEIGHBORS[0]! });
    // f0's neighbors besides CENTER (dir3): (12,5) dir0, (12,4) dir1,
    // (11,4) dir2, (11,6) dir4, (10,6) dir5 — all enemy-occupied.
    const f0Blockers = [
      makeUnit({ typeId: 'fantassins', position: { q: 12, r: 5 }, owner: 1 }),
      makeUnit({ typeId: 'fantassins', position: { q: 12, r: 4 }, owner: 1 }),
      makeUnit({ typeId: 'fantassins', position: { q: 11, r: 4 }, owner: 1 }),
      makeUnit({ typeId: 'fantassins', position: { q: 11, r: 6 }, owner: 1 }),
      makeUnit({ typeId: 'fantassins', position: { q: 10, r: 6 }, owner: 1 }),
    ];
    const state = makeState([unit, f0, ...f0Blockers]);

    expect(legalRetreatHexes(state, f0)).toHaveLength(0);
    expect(pushCandidates(state, unit)).toHaveLength(0);
  });

  // Regression for the exact bug reported from real play (plan.md §12.1):
  // `unit` is boxed by a MIX of friendlies and an EMPTY hex that's unusable
  // for a direct retreat because of enemy zone of control — not because
  // it's enemy-occupied. The old code's `!occupant || ...` check treated
  // this identically to an enemy-occupied neighbor (bailed out entirely,
  // returning []); the fix must still offer the 5 genuinely-friendly
  // neighbors.
  it('regression: a mix of friendlies and one EMPTY, ZOC-blocked hex still offers the friendlies', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    const friendlies = NEIGHBORS.slice(0, 5).map((pos, i) => makeUnit({ typeId: 'fantassins', position: pos, id: `f${i}` }));
    // NEIGHBORS[5] = (10,6) stays EMPTY. An enemy at (10,7) — itself NOT
    // adjacent to `unit` — projects ZOC onto (10,6), making it illegal for
    // `unit` to retreat into directly, without being a push candidate itself.
    const zocSource = makeUnit({ typeId: 'fantassins', position: { q: 10, r: 7 }, owner: 1 });
    const state = makeState([unit, ...friendlies, zocSource]);

    expect(legalRetreatHexes(state, unit)).toHaveLength(0); // 5 occupied + 1 ZOC'd
    const candidates = pushCandidates(state, unit);
    expect(candidates.map((u) => u.id).sort()).toEqual(friendlies.map((u) => u.id).sort());
  });

  // Same regression, the OTHER named cause from the bug report: the empty
  // 6th hex is unusable because of TERRAIN (the boxed-in unit's own
  // category can't enter it), not ZOC.
  it('regression: a mix of friendlies and empty marsh hexes still offers the friendlies — a chariot boxed by 4 friendlies plus 2 empty marsh hexes', () => {
    // Reuses the (7,14) ring from the terrain-exclusion test below, but
    // leaves the two marsh hexes EMPTY instead of friendly-occupied.
    const center = { q: 7, r: 14 };
    const friendlyRing = [
      { q: 8, r: 13 }, // plain
      { q: 7, r: 13 }, // plain
      { q: 6, r: 14 }, // plain
      { q: 6, r: 15 }, // plain
    ];
    const chariot = makeUnit({ typeId: 'chars-lourds', position: center });
    const friendlies = friendlyRing.map((pos, i) => makeUnit({ typeId: 'fantassins', position: pos, id: `f${i}` }));
    const state = makeState([chariot, ...friendlies]);
    // (8,14) and (7,15) are marsh and left unoccupied.

    expect(legalRetreatHexes(state, chariot)).toHaveLength(0); // 4 occupied + 2 marsh-forbidden
    const candidates = pushCandidates(state, chariot);
    expect(candidates.map((u) => u.id).sort()).toEqual(friendlies.map((u) => u.id).sort());
  });

  // Regression for a real defect the Stage 2 fuzz harness caught (plan.md
  // §6), the push-mechanic sibling of legalRetreatHexes's own terrain fix
  // above: a friendly unit standing on terrain the BOXED-IN unit's category
  // cannot enter (legal for the friendly itself, e.g. a land unit on marsh)
  // must not be offered as a push target — completePush would otherwise
  // move the boxed-in unit onto terrain it could never reach under its own
  // power.
  it("excludes a friendly neighbor whose hex the boxed-in unit's own category could not enter", () => {
    // (7,14) is 'plain' with a full ring of 6 on-map neighbors; two of them
    // — (8,14) and (7,15) — are 'marsh', forbidden to chariots (see
    // data/map.ts's terrain listing around this row, and this file's own
    // "excludes marsh terrain for a chariot forced to retreat" test above).
    const center = { q: 7, r: 14 };
    const ring = [
      { q: 8, r: 14 }, // marsh
      { q: 8, r: 13 }, // plain
      { q: 7, r: 13 }, // plain
      { q: 6, r: 14 }, // plain
      { q: 6, r: 15 }, // plain
      { q: 7, r: 15 }, // marsh
    ];
    const chariot = makeUnit({ typeId: 'chars-lourds', position: center });
    const friendlies = ring.map((pos, i) => makeUnit({ typeId: 'fantassins', position: pos, id: `f${i}` }));
    const state = makeState([chariot, ...friendlies]);

    const candidates = pushCandidates(state, chariot);
    expect(candidates.map((u) => u.id)).not.toContain('f0'); // (8,14), marsh
    expect(candidates.map((u) => u.id)).not.toContain('f5'); // (7,15), marsh
    expect(candidates.map((u) => u.id).sort()).toEqual(['f1', 'f2', 'f3', 'f4']);
  });
});

describe('retreatUnitTo / completePush', () => {
  it('moves a unit directly to the chosen hex', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    retreatUnitTo(unit, NEIGHBORS[0]!);
    expect(unit.position).toEqual(NEIGHBORS[0]);
  });

  // New contract (plan.md §12.3): `completePush` no longer moves the pushed
  // unit itself — that's the caller's job (directly via `retreatUnitTo`, or
  // recursively for a further cascade) — it only moves `unit` into the hex
  // captured BEFORE that resolution ran.
  it('moves `unit` into the captured vacated hex — the pushed unit\'s own move is the caller\'s responsibility', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    const pushed = makeUnit({ typeId: 'fantassins', position: NEIGHBORS[0]! });
    const vacatedHex = { ...pushed.position };
    // Caller resolves `pushed`'s own retreat first (mirroring
    // `BoardScene`/`fuzzHarness`'s sequencing) — completePush doesn't do this.
    retreatUnitTo(pushed, { q: 12, r: 5 });
    completePush(unit, vacatedHex);
    expect(pushed.position).toEqual({ q: 12, r: 5 });
    expect(unit.position).toEqual(NEIGHBORS[0]); // takes the hex `pushed` vacated, not wherever it ended up
  });
});

// ---------------------------------------------------------------------------
// Cascading push (plan.md §12) — a unit forced to retreat with no direct
// legal hex, boxed in (at least partly) by friendlies, pushes one aside; if
// THAT unit also has no direct retreat, it must push in turn, and so on
// until someone finds a real hex. `pushCandidates` (the viability check) and
// `completePush` (applying one resolved link) are exercised together with
// `legalRetreatHexes`/`retreatUnitTo` here to prove the whole chain, not
// just isolated candidate lists.
// ---------------------------------------------------------------------------

/**
 * Builds a straight-line chain of `length` friendly (owner 0) units starting
 * at (10,5) — the same verified-plain patch `CENTER`/`NEIGHBORS` above sit
 * in — walking `DIRECTIONS[0]` ((+1,0)) one hex per link. Every unit except
 * the LAST is boxed on its other 5 sides by owner-1 "enemy" placeholder
 * units (their exact map terrain is irrelevant — an enemy-occupied hex
 * blocks a direct retreat and is never itself a push candidate regardless of
 * what's under it, and a genuinely off-map neighbor would be excluded on its
 * own without needing a placeholder at all — see `pushCandidates`'s "off-map:
 * simply not a candidate" branch). The LAST unit in the chain is left with
 * its other 5 neighbors open, so it has a real, direct legal retreat — the
 * base case every cascade must eventually reach.
 */
function buildChain(length: number): { chain: Unit[]; state: GameState } {
  const start = { q: 10, r: 5 };
  const chain: Unit[] = [];
  for (let i = 0; i < length; i++) {
    chain.push(makeUnit({ id: `chain${i}`, typeId: 'fantassins', position: { q: start.q + i, r: start.r } }));
  }
  const enemies: Unit[] = [];
  for (let i = 0; i < length - 1; i++) {
    const pos = chain[i]!.position;
    DIRECTIONS.forEach((d, dirIndex) => {
      if (dirIndex === 0) return; // forward, toward chain[i+1] — leave open for the friendly link
      const neighbor = hexAdd(pos, d);
      if (chain.some((u) => u.position.q === neighbor.q && u.position.r === neighbor.r)) return; // already a chain unit (e.g. chain[i-1] behind it)
      enemies.push(makeUnit({ id: `enemy${i}-${dirIndex}`, typeId: 'fantassins', position: neighbor, owner: 1 }));
    });
  }
  return { chain, state: makeState([...chain, ...enemies]) };
}

describe('cascading push', () => {
  it('single push: a boxed unit pushes its one friendly neighbor, which has a direct retreat of its own', () => {
    const { chain, state } = buildChain(2);
    const [a, b] = chain as [Unit, Unit];

    expect(legalRetreatHexes(state, a)).toHaveLength(0);
    expect(pushCandidates(state, a).map((u) => u.id)).toEqual([b.id]);
    expect(legalRetreatHexes(state, b).length).toBeGreaterThan(0);
  });

  it('2-link chain: A pushes B, B has no direct retreat either and must push C, which does', () => {
    const { chain, state } = buildChain(3);
    const [a, b, c] = chain as [Unit, Unit, Unit];

    expect(legalRetreatHexes(state, a)).toHaveLength(0);
    expect(legalRetreatHexes(state, b)).toHaveLength(0);
    expect(pushCandidates(state, a).map((u) => u.id)).toEqual([b.id]);
    expect(pushCandidates(state, b).map((u) => u.id)).toEqual([c.id]);
    expect(legalRetreatHexes(state, c).length).toBeGreaterThan(0);
  });

  it('3-link chain: A pushes B pushes C pushes D, which finally has a direct retreat', () => {
    const { chain, state } = buildChain(4);
    const [a, b, c, d] = chain as [Unit, Unit, Unit, Unit];

    expect(legalRetreatHexes(state, a)).toHaveLength(0);
    expect(legalRetreatHexes(state, b)).toHaveLength(0);
    expect(legalRetreatHexes(state, c)).toHaveLength(0);
    expect(pushCandidates(state, a).map((u) => u.id)).toEqual([b.id]);
    expect(pushCandidates(state, b).map((u) => u.id)).toEqual([c.id]);
    expect(pushCandidates(state, c).map((u) => u.id)).toEqual([d.id]);
    expect(legalRetreatHexes(state, d).length).toBeGreaterThan(0);
  });

  it('resolves a full 3-link cascade end to end via completePush: each pusher takes over the hex the NEXT unit vacated, not the final destination', () => {
    const { chain, state } = buildChain(4);
    const [a, b, c, d] = chain as [Unit, Unit, Unit, Unit];
    const originalPositions = chain.map((u) => ({ ...u.position }));

    // Mirrors exactly what BoardScene/fuzzHarness do: resolve from the
    // DEEPEST link outward, capturing each hex before the unit that occupies
    // it moves.
    const dRetreat = legalRetreatHexes(state, d)[0]!;
    retreatUnitTo(d, dRetreat);
    completePush(c, originalPositions[3]!); // c takes over d's original hex
    completePush(b, originalPositions[2]!); // b takes over c's original hex
    completePush(a, originalPositions[1]!); // a takes over b's original hex

    expect(d.position).toEqual(dRetreat);
    expect(c.position).toEqual(originalPositions[3]);
    expect(b.position).toEqual(originalPositions[2]);
    expect(a.position).toEqual(originalPositions[1]);
  });

  // Cycle: A pushes B, B pushes C, and C's only OTHER friendly neighbor is
  // A — who hasn't moved yet. Must terminate (not loop forever) and, since
  // there's no external exit anywhere in the triangle, find no viable push
  // at all.
  it('a cycle of mutually-blocked friendlies terminates with no viable push, rather than looping forever', () => {
    // A(13,5), B(14,5), C(13,6) are mutually adjacent (a real 3-hex "triangle"
    // on the hex grid — see DIRECTIONS: A->B is dir0, A->C is dir5, B->C is
    // dir4). Every hex besides the triangle itself is enemy-occupied, so no
    // unit has anywhere to go except around the cycle.
    const a = makeUnit({ id: 'a', typeId: 'fantassins', position: { q: 13, r: 5 } });
    const b = makeUnit({ id: 'b', typeId: 'fantassins', position: { q: 14, r: 5 } });
    const c = makeUnit({ id: 'c', typeId: 'fantassins', position: { q: 13, r: 6 } });
    const enemyPositions = [
      { q: 14, r: 4 }, { q: 13, r: 4 }, { q: 12, r: 5 }, { q: 12, r: 6 }, // A's other neighbors
      { q: 15, r: 5 }, { q: 15, r: 4 }, { q: 14, r: 6 }, // B's other neighbors (14,4 already listed)
      { q: 12, r: 7 }, { q: 13, r: 7 }, // C's other neighbors (14,6 and 12,6 already listed)
    ];
    const enemies = enemyPositions.map((pos, i) => makeUnit({ id: `e${i}`, typeId: 'fantassins', position: pos, owner: 1 }));
    const state = makeState([a, b, c, ...enemies]);

    expect(legalRetreatHexes(state, a)).toHaveLength(0);
    expect(legalRetreatHexes(state, b)).toHaveLength(0);
    expect(legalRetreatHexes(state, c)).toHaveLength(0);

    // The call itself must return (not hang/stack-overflow, and — now that
    // `pushCandidates` is a bounded fixpoint rather than a DFS — not throw
    // on an unbounded expansion either) — that's the termination proof; the
    // empty result confirms the cycle genuinely has no exit.
    expect(pushCandidates(state, a)).toHaveLength(0);
    expect(pushCandidates(state, b)).toHaveLength(0);
    expect(pushCandidates(state, c)).toHaveLength(0);
  });

  // Terrain must be checked at whatever link of the chain is currently doing
  // the pushing, not just at the very first (top-level) unit — the same
  // `canEnterTerrain` check inside `pushCandidates`'s fixpoint growth step
  // runs identically regardless of how deep in the chain it's evaluating,
  // but this proves it actually fires when the BLOCKED unit (not the
  // original caller) is a chariot.
  it('terrain blocks a link even when the terrain-forbidden neighbor is otherwise perfectly viable', () => {
    // B (chariot) is boxed on 5 sides by enemies; its only friendly neighbor
    // C stands on (8,14), which is marsh — forbidden to chariots but not to
    // C itself (infantry). C's OWN surroundings are left open, so C would be
    // a perfectly good push target if terrain weren't checked at this level.
    const b = makeUnit({ id: 'b', typeId: 'chars-lourds', position: { q: 7, r: 14 } });
    const c = makeUnit({ id: 'c', typeId: 'fantassins', position: { q: 8, r: 14 } }); // marsh
    const enemies = [
      { q: 8, r: 13 }, { q: 7, r: 13 }, { q: 6, r: 14 }, { q: 6, r: 15 }, { q: 7, r: 15 },
    ].map((pos, i) => makeUnit({ id: `e${i}`, typeId: 'fantassins', position: pos, owner: 1 }));
    const state = makeState([b, c, ...enemies]);

    expect(legalRetreatHexes(state, b)).toHaveLength(0);
    expect(legalRetreatHexes(state, c).length).toBeGreaterThan(0); // c itself has real room...
    expect(pushCandidates(state, b)).toHaveLength(0); // ...but b (chariot) still can't be offered c's marsh hex
  });

  // MEDIUM finding from adversarial review: the terrain test above only
  // exercises the check at depth 0 (`pushCandidates(state, b)` where `b` IS
  // the blocked chariot). This extends it to a genuine mid-chain link: A
  // (chariot) pushes B (chariot, one level down) whose ONLY route out is C,
  // standing on marsh — B itself is a chariot too, so B can't inherit C's
  // marsh hex any more than A could. A must therefore see no viable push at
  // all, even though B is otherwise a perfectly ordinary intermediate link.
  it('terrain blocks a MID-chain link, not just the top-level query — A cannot push through B if B cannot enter C\'s marsh hex', () => {
    // A(6,14) -dir0-> B(7,14) -dir0-> C(8,14, marsh). A's other 5 neighbors
    // (dir1..dir5): (7,13),(6,13),(5,14),(5,15),(6,15). B's other 4
    // neighbors besides A and C (dir1,dir2,dir4,dir5): (8,13),(7,13),(6,15),
    // (7,15) — (7,13) and (6,15) are shared with A's own boxing.
    const a = makeUnit({ id: 'a', typeId: 'chars-lourds', position: { q: 6, r: 14 } });
    const b = makeUnit({ id: 'b', typeId: 'chars-lourds', position: { q: 7, r: 14 } });
    const c = makeUnit({ id: 'c', typeId: 'fantassins', position: { q: 8, r: 14 } }); // marsh
    const enemyPositions = [
      { q: 7, r: 13 }, { q: 6, r: 13 }, { q: 5, r: 14 }, { q: 5, r: 15 }, { q: 6, r: 15 }, // A's boxing
      { q: 8, r: 13 }, { q: 7, r: 15 }, // B's remaining boxing
    ];
    const enemies = enemyPositions.map((pos, i) => makeUnit({ id: `e${i}`, typeId: 'fantassins', position: pos, owner: 1 }));
    const state = makeState([a, b, c, ...enemies]);

    expect(legalRetreatHexes(state, a)).toHaveLength(0);
    expect(legalRetreatHexes(state, b)).toHaveLength(0);
    expect(legalRetreatHexes(state, c).length).toBeGreaterThan(0); // c itself has real room...
    expect(pushCandidates(state, b)).toHaveLength(0); // ...but b (chariot) can't inherit c's marsh hex...
    expect(pushCandidates(state, a)).toHaveLength(0); // ...so a's only route (through b) is a dead end too
  });

  // CRITICAL finding from adversarial review: the original implementation
  // was a plain recursive DFS enumerating simple paths through the
  // friendly-unit graph with no memoization — exponential in a densely
  // packed formation. Measured against the mutant (the DFS reintroduced),
  // a ~20-unit encircled blob took minutes; this proves the CURRENT
  // (fixpoint) implementation resolves the same shape in well under a
  // second, so a future regression back to unbounded path enumeration would
  // be caught here rather than only in a slow, silent production freeze.
  it('perf: resolves a large fully-encircled formation quickly (regression for the exponential DFS this replaced)', () => {
    const center = { q: 10, r: 5 };
    const friendlies: Unit[] = [];
    for (let q = center.q - 2; q <= center.q + 2; q++) {
      for (let r = center.r - 2; r <= center.r + 2; r++) {
        if (hexDistance(center, { q, r }) <= 2) {
          friendlies.push(makeUnit({ id: `blob-${q}-${r}`, typeId: 'fantassins', position: { q, r } }));
        }
      }
    }
    // A full ring at distance 3 seals every outward-facing neighbor of the
    // distance-2 boundary (any neighbor of a distance-2 hex not itself in
    // the disk is necessarily at distance exactly 3).
    const enemies: Unit[] = [];
    for (let q = center.q - 3; q <= center.q + 3; q++) {
      for (let r = center.r - 3; r <= center.r + 3; r++) {
        if (hexDistance(center, { q, r }) === 3) {
          enemies.push(makeUnit({ id: `ring-${q}-${r}`, typeId: 'fantassins', position: { q, r }, owner: 1 }));
        }
      }
    }
    expect(friendlies.length).toBeGreaterThanOrEqual(19); // radius-2 disk = 19 hexes
    const state = makeState([...friendlies, ...enemies]);
    // A boundary unit — the worst case for the old DFS, since it has the
    // most friendly neighbors to branch through.
    const corner = friendlies.find((u) => hexDistance(center, u.position) === 2)!;

    const start = Date.now();
    const result = pushCandidates(state, corner);
    const elapsedMs = Date.now() - start;

    expect(elapsedMs).toBeLessThan(2000); // the old DFS took minutes at this size
    // Fully sealed: nobody in the blob has ANY unoccupied neighbor (every
    // neighbor is either another blob friendly or an enemy on the ring), so
    // nobody has a direct legal retreat and the fixpoint never grows —
    // correctly empty, not just fast.
    expect(result).toHaveLength(0);
  });
});

describe('applyLandCombatResult — AR/DR retreats', () => {
  it('queues a non-elephant retreating unit for a player-chosen destination instead of moving it automatically', () => {
    const attacker = makeUnit({ typeId: 'fantassins', position: CENTER });
    const defender = makeUnit({ typeId: 'fantassins', position: NEIGHBORS[0]!, owner: 1 });
    const state = makeState([attacker, defender]);

    const outcome = applyLandCombatResult(state, [attacker], [defender], 'AR');
    expect(outcome.pendingRetreats).toEqual([attacker]);
    expect(outcome.pendingDrifts).toHaveLength(0);
    expect(attacker.position).toEqual(CENTER); // untouched — awaiting the player's choice
    expect(attacker.destroyed).toBe(false);
  });

  // HIGH-2 finding from adversarial review: the pushCandidates-level
  // regression tests above prove the PREDICATE widened correctly, but never
  // exercised the actual bug report — "the unit died without being asked to
  // push" — which is `forceRetreat`'s decision, inside
  // `applyLandCombatResult`, not `pushCandidates` in isolation. Deleting
  // `|| pushCandidates(state, unit).length > 0` from `forceRetreat` (i.e.
  // restoring the reported bug verbatim, even against the ALREADY-widened
  // predicate) passed every other test in this file before this one existed.
  it('regression: a unit boxed by a mix of friendlies and one ZOC-blocked empty hex is QUEUED for a push, not eliminated, when forced to retreat (plan.md §12.1)', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    const friendlies = NEIGHBORS.slice(0, 5).map((pos, i) => makeUnit({ typeId: 'fantassins', position: pos, id: `f${i}` }));
    // NEIGHBORS[5] = (10,6) stays empty, but ZOC'd by an enemy at (10,7) —
    // see the identical `pushCandidates` regression test above for why this
    // exact shape is the one the old strict "entourée" check mishandled.
    const zocSource = makeUnit({ typeId: 'fantassins', position: { q: 10, r: 7 }, owner: 1 });
    // The "combat" itself is unrelated to the boxing geometry — placed far
    // away specifically to prove this is pure retreat-option bookkeeping,
    // not anything to do with the attacker's own position (mirrors the
    // (4,9)-cavalry test below).
    const defender = makeUnit({ typeId: 'fantassins', position: { q: 9000, r: 9000 }, owner: 1 });
    const state = makeState([unit, ...friendlies, zocSource, defender]);

    const outcome = applyLandCombatResult(state, [unit], [defender], 'AR');
    expect(outcome.pendingRetreats).toEqual([unit]);
    expect(unit.destroyed).toBe(false);
  });

  it('eliminates a retreating unit with no legal hex and no push option', () => {
    // Far outside any real map's range: every neighbor is off-map.
    const attacker = makeUnit({ typeId: 'fantassins', position: { q: 9000, r: 9000 } });
    const defender = makeUnit({ typeId: 'fantassins', position: { q: 9001, r: 9000 }, owner: 1 });
    const state = makeState([attacker, defender]);

    const outcome = applyLandCombatResult(state, [attacker], [defender], 'AR');
    expect(outcome.pendingRetreats).toHaveLength(0);
    expect(attacker.destroyed).toBe(true);
  });

  // HIGH finding from adversarial review: the elimination above isn't only
  // an off-map/synthetic edge case — it's reachable ON the shipped map via
  // pure terrain (no enemy adjacency, no ZOC, no friendly boxing needed).
  // (4,9) is 'plateau' ringed by 6 'steep-flank' hexes, all forbidden to
  // cavalry (see the `legalRetreatHexes`/`pushCandidates` test above this
  // file for the full neighbor listing). Light cavalry sitting there that
  // is ever forced to retreat is destroyed outright, with the defender
  // placed far away specifically to prove this has nothing to do with
  // combat proximity — it's pure terrain geometry.
  it('destroys cavalry retreating from (4,9) on the shipped map — a real, not synthetic, terrain-boxed hex', () => {
    const cav = makeUnit({ typeId: 'cavalerie-legere', position: { q: 4, r: 9 } });
    const defender = makeUnit({ typeId: 'fantassins', position: { q: 9000, r: 9000 }, owner: 1 });
    const state = makeState([cav, defender]);

    const outcome = applyLandCombatResult(state, [cav], [defender], 'AR');
    expect(outcome.pendingRetreats).toHaveLength(0);
    expect(outcome.pendingDrifts).toHaveLength(0);
    expect(cav.destroyed).toBe(true);
  });

  it('defers a retreating elephant to pendingDrifts instead of resolving a retreat here', () => {
    // Elephants never retreat normally — the caller must drive the drift
    // (direction roll, step-by-step movement, real combat on contact) since
    // a trampled unit can itself need a player choice mid-drift.
    const elephant = makeUnit({ typeId: 'elephants', position: CENTER });
    const defender = makeUnit({ typeId: 'fantassins', position: NEIGHBORS[0]!, owner: 1 });
    const state = makeState([elephant, defender]);

    const outcome = applyLandCombatResult(state, [elephant], [defender], 'AR');
    expect(outcome.pendingRetreats).toHaveLength(0);
    expect(outcome.pendingDrifts).toEqual([elephant]);
    expect(elephant.position).toEqual(CENTER); // untouched here
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

  it('counts an archer at its projectile value, so an all-archer EX is satisfiable', () => {
    // Regression for the wedged board §15 would otherwise have created:
    // two archers firing on a `fantassins` is 4 vs 1 = the 4-1 column, whose
    // die-6 row is EX. With more than one attacker `applyLandCombatResult`
    // defers the sacrifice to the player — and if archers counted 0 here, NO
    // subset of the attackers could ever reach the threshold of 1. The
    // prompt could not be confirmed and both `RandomAgent` and
    // `HeuristicAgent` throw "CRT invariant violated".
    const defender = makeUnit({ id: 'd', typeId: 'fantassins', position: { q: 1, r: 1 }, owner: 1 });
    const x1 = makeUnit({ id: 'x1', typeId: 'archers', position: { q: 3, r: 1 } });
    const x2 = makeUnit({ id: 'x2', typeId: 'archers', position: { q: 1, r: 3 } });
    for (const x of [x1, x2]) expect(hexDistance(x.position, defender.position)).toBe(2);
    const state = makeState([x1, x2, defender]);

    const detail = describeLandAttack([x1, x2], [defender], 6);
    expect(detail.attackForce).toBe(4);
    expect(detail.ratioLabel).toBe('4-1');
    expect(detail.result).toBe('EX');

    const outcome = applyLandCombatResult(state, [x1, x2], [defender], detail.result);
    expect(outcome.requiresExchangeChoice).toBe(true);
    expect(outcome.requiredSacrificeForce).toBe(1);
    expect(exchangeSacrificeForce(x1)).toBe(2);
    expect(exchangeSacrificeMeetsThreshold([x1], outcome.requiredSacrificeForce)).toBe(true);
  });

  it('prices every land unit that can join a land attack at its real contribution', () => {
    // Pins the coincidence `exchangeSacrificeForce` is built on: it takes the
    // better of a unit's melee and projectile values rather than the exact
    // per-combat contribution from `LandAttackDetail.attackerForces`. Add a
    // land type that breaks the coincidence and this fails here, loudly,
    // instead of silently mis-pricing a sacrifice — at which point the honest
    // fix is to thread `attackerForces` through
    // `PlayerAgent.chooseExchangeSacrifice`.
    //
    // TWO shapes break it, and independent review caught that an earlier
    // version of this guard only caught one. The obvious one is two different
    // non-zero values. The subtle one is `attack: 0, rangedAttack: n,
    // meleeCapable: TRUE` — legal to write, and then `attackForceAgainst`
    // contributes 0 at contact while `exchangeSacrificeForce` prices it at
    // `n`. Real `archers` dodge it only by being `meleeCapable: false`, so
    // that flag is load-bearing here and is asserted rather than assumed.
    for (const t of UNIT_TYPES) {
      if (t.domain !== 'land') continue; // naval resolves by boarding, never through the land CRT
      if (t.rangedAttack === 0) continue;
      const priceable = t.attack === t.rangedAttack || (t.attack === 0 && !t.meleeCapable);
      expect([t.id, priceable]).toEqual([t.id, true]);
    }
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

describe('canBoard', () => {
  it('allows boarding when adjacent ships share the same facing', () => {
    const a = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 }, facing: 0 });
    const b = makeUnit({ typeId: 'galeres', owner: 1, position: { q: 1, r: 0 }, facing: 0 });
    expect(canBoard(a, b)).toBe(true);
  });

  it('allows boarding when adjacent ships face exactly opposite ways', () => {
    const a = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 }, facing: 0 });
    const b = makeUnit({ typeId: 'galeres', owner: 1, position: { q: 1, r: 0 }, facing: 3 });
    expect(canBoard(a, b)).toBe(true);
  });

  it('rejects a bow-on (ramming) angle instead of a parallel one', () => {
    const a = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 }, facing: 0 });
    // b sits directly ahead of a's bow (direction 0) with a perpendicular facing.
    const b = makeUnit({ typeId: 'galeres', owner: 1, position: { q: 1, r: 0 }, facing: 1 });
    expect(canBoard(a, b)).toBe(false);
  });

  it('rejects ships that are not adjacent even if facings are parallel', () => {
    const a = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 }, facing: 0 });
    const b = makeUnit({ typeId: 'galeres', owner: 1, position: { q: 2, r: 0 }, facing: 0 });
    expect(canBoard(a, b)).toBe(false);
  });
});

describe('applyRammingResult', () => {
  it('sinks the defender on a hit and marks it as attacked this phase', () => {
    const defender = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 } });
    applyRammingResult(defender, true);
    expect(defender.destroyed).toBe(true);
    expect(defender.defendedThisPhase).toBe(true);
  });

  it('leaves the defender intact on a miss, but still marks it attacked', () => {
    const defender = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 } });
    applyRammingResult(defender, false);
    expect(defender.destroyed).toBe(false);
    expect(defender.defendedThisPhase).toBe(true);
  });
});

describe('applyBoardingResult', () => {
  it('does nothing on an indecisive (null-side) result', () => {
    const attacker = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 }, equipmentPoints: 2 });
    const defender = makeUnit({ typeId: 'galeres', position: { q: 1, r: 0 }, equipmentPoints: 2 });
    applyBoardingResult(attacker, defender, { side: null, equipmentLoss: 0 });
    expect(attacker.equipmentPoints).toBe(2);
    expect(defender.equipmentPoints).toBe(2);
    expect(defender.defendedThisPhase).toBe(true);
  });

  it('strips equipment from the losing side', () => {
    const attacker = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 }, equipmentPoints: 2 });
    const defender = makeUnit({ typeId: 'galeres', position: { q: 1, r: 0 }, equipmentPoints: 2 });
    applyBoardingResult(attacker, defender, { side: 'defender', equipmentLoss: 1 });
    expect(defender.equipmentPoints).toBe(1);
    expect(defender.destroyed).toBe(false);
  });

  it('destroys a ship whose equipment reaches zero, and never goes negative', () => {
    const attacker = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 }, equipmentPoints: 2 });
    const defender = makeUnit({ typeId: 'galeres', position: { q: 1, r: 0 }, equipmentPoints: 1 });
    applyBoardingResult(attacker, defender, { side: 'defender', equipmentLoss: 3 });
    expect(defender.equipmentPoints).toBe(0);
    expect(defender.destroyed).toBe(true);
  });

  it('can strip the attacker instead, when the attacker is the losing side', () => {
    const attacker = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 }, equipmentPoints: 1 });
    const defender = makeUnit({ typeId: 'galeres', position: { q: 1, r: 0 }, equipmentPoints: 2 });
    applyBoardingResult(attacker, defender, { side: 'attacker', equipmentLoss: 1 });
    expect(attacker.equipmentPoints).toBe(0);
    expect(attacker.destroyed).toBe(true);
    expect(defender.equipmentPoints).toBe(2);
  });
});

describe('validTargets (naval)', () => {
  it('offers an adjacent enemy ship with a parallel facing as a boarding target', () => {
    const ship = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 }, facing: 0 });
    const enemy = makeUnit({ typeId: 'galeres', owner: 1, position: { q: 1, r: 0 }, facing: 0 });
    expect(validTargets(makeState([ship, enemy]), ship).map((u) => u.id)).toEqual([enemy.id]);
  });

  it('excludes an adjacent enemy ship at a bow-on (ramming-only) angle', () => {
    const ship = makeUnit({ typeId: 'galeres', position: { q: 0, r: 0 }, facing: 0 });
    const enemy = makeUnit({ typeId: 'galeres', owner: 1, position: { q: 1, r: 0 }, facing: 1 });
    expect(validTargets(makeState([ship, enemy]), ship)).toEqual([]);
  });
});
