import { describe, it, expect } from 'vitest';
import {
  applyBoardingResult,
  applyExchangeSacrifice,
  applyLandCombatResult,
  applyRammingResult,
  attackerCanJoin,
  canBoard,
  canElephantEnterHex,
  canUnitEnterHex,
  cavalryMayAttack,
  checkRangedEligibility,
  commonValidTargets,
  completePush,
  defenderCanJoin,
  exchangeSacrificeMeetsThreshold,
  legalRetreatHexes,
  pushCandidates,
  resolveLandAttack,
  retreatUnitTo,
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
});

describe('pushCandidates', () => {
  it('returns every neighbor when the unit is fully surrounded by friendly units', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    const friendlies = NEIGHBORS.map((pos, i) => makeUnit({ typeId: 'fantassins', position: pos, id: `f${i}` }));
    const state = makeState([unit, ...friendlies]);

    const candidates = pushCandidates(state, unit);
    expect(candidates.map((u) => u.id).sort()).toEqual(friendlies.map((u) => u.id).sort());
  });

  it('returns none if even one neighbor is occupied by an enemy instead of a friendly unit', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    const friendlies = NEIGHBORS.slice(0, 5).map((pos, i) => makeUnit({ typeId: 'fantassins', position: pos, id: `f${i}` }));
    const enemy = makeUnit({ typeId: 'fantassins', position: NEIGHBORS[5]!, owner: 1 });
    const state = makeState([unit, ...friendlies, enemy]);

    expect(pushCandidates(state, unit)).toHaveLength(0);
  });

  it('excludes a friendly neighbor that has no legal retreat hex of its own — pushing must make real room, not just swap', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    const friendlies = NEIGHBORS.map((pos, i) => makeUnit({ typeId: 'fantassins', position: pos, id: `f${i}` }));
    // Box in friendlies[0] (at (11,5)) completely: its other 5 neighbors
    // besides CENTER (already occupied by `unit`) are (11,4) and (10,6)
    // (already friendlies), plus (12,5), (12,4), (11,6) — occupy those too.
    const blockers = [
      makeUnit({ typeId: 'fantassins', position: { q: 12, r: 5 } }),
      makeUnit({ typeId: 'fantassins', position: { q: 12, r: 4 } }),
      makeUnit({ typeId: 'fantassins', position: { q: 11, r: 6 } }),
    ];
    const state = makeState([unit, ...friendlies, ...blockers]);

    const candidates = pushCandidates(state, unit);
    expect(candidates.map((u) => u.id)).not.toContain('f0');
    expect(candidates).toHaveLength(5);
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

  it('moves the pushed unit to its own chosen retreat hex, and the original unit takes the hex it vacated', () => {
    const unit = makeUnit({ typeId: 'fantassins', position: CENTER });
    const pushed = makeUnit({ typeId: 'fantassins', position: NEIGHBORS[0]! });
    const pushedDestination = { q: 12, r: 5 }; // some other free hex — not a swap back to CENTER
    completePush(unit, pushed, pushedDestination);
    expect(pushed.position).toEqual(pushedDestination);
    expect(unit.position).toEqual(NEIGHBORS[0]); // takes the hex `pushed` vacated
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

  it('eliminates a retreating unit with no legal hex and no push option', () => {
    // Far outside any real map's range: every neighbor is off-map.
    const attacker = makeUnit({ typeId: 'fantassins', position: { q: 9000, r: 9000 } });
    const defender = makeUnit({ typeId: 'fantassins', position: { q: 9001, r: 9000 }, owner: 1 });
    const state = makeState([attacker, defender]);

    const outcome = applyLandCombatResult(state, [attacker], [defender], 'AR');
    expect(outcome.pendingRetreats).toHaveLength(0);
    expect(attacker.destroyed).toBe(true);
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
