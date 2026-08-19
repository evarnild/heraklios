import { describe, it, expect } from 'vitest';
import { unitCategory, evaluateCharge, reachableHexes } from './movement';
import { createInitialState } from './turnManager';
import { UNIT_TYPES } from '../data/units';
import type { GameState, Unit } from './state';

describe('unitCategory', () => {
  it('identifies chariots', () => {
    expect(unitCategory('chars-legers')).toBe('chariot');
    expect(unitCategory('chars-lourds')).toBe('chariot');
  });

  it('identifies cavalry', () => {
    expect(unitCategory('cavalerie-legere')).toBe('cavalry');
    expect(unitCategory('cavalerie-lourde')).toBe('cavalry');
  });

  it('identifies elephants', () => {
    expect(unitCategory('elephants')).toBe('elephant');
  });

  it('falls back to plain "land" for other land unit types', () => {
    expect(unitCategory('archers')).toBe('land');
    expect(unitCategory('fantassins')).toBe('land');
    expect(unitCategory('fantassins-archers')).toBe('land');
    expect(unitCategory('fantassins-lourds')).toBe('land');
    expect(unitCategory('phalanges')).toBe('land');
  });

  it('categorizes every naval unit type as "naval"', () => {
    for (const t of UNIT_TYPES.filter((u) => u.domain === 'naval')) {
      expect(unitCategory(t.id)).toBe('naval');
    }
  });

  it('covers every unit type in the game with no fallthrough gaps', () => {
    for (const t of UNIT_TYPES) {
      expect(unitCategory(t.id)).toBeTruthy();
    }
  });
});

// (10,3) through (19,3) — a straight run in DIRECTIONS[0] ({q:1,r:0}) — are
// all confirmed 'plain' hexes on the shipped map (see `ui/testMode.ts`'s
// `startCloseCombatTestGame` comment, which lines up land test units along
// this exact row).
function makeCavalry(overrides: Partial<Unit> & { typeId: string }): Unit {
  return {
    id: overrides.id ?? `cav-${Math.random()}`,
    owner: 0,
    position: { q: 10, r: 3 },
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
    movementLeft: 0,
    ...overrides,
  };
}

function makeState(units: Unit[]): GameState {
  const state = createInitialState([], 'multi-defender');
  state.units = units;
  return state;
}

describe('evaluateCharge', () => {
  it('is a charge: cavalry spends its full allowance in a straight line and ends adjacent to an enemy — returns the cost to deduct', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 }); // full allowance
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 17, r: 3 } });
    const state = makeState([cav, enemy]);
    // distance 6, adjacent to enemy at (17,3), all-plain so straight cost === distance.
    expect(evaluateCharge(state, cav, { q: 16, r: 3 })).toBe(6);
  });

  it('is not a charge when the move stops short of the full allowance ("ordinary attack")', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 12, r: 3 } });
    const state = makeState([cav, enemy]);
    // Distance 1 (cost 1) leaves 5 of the 6 points unspent.
    expect(evaluateCharge(state, cav, { q: 11, r: 3 })).toBeNull();
  });

  it('is not a charge when the destination is not reachable via a single straight line', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 });
    const state = makeState([cav]);
    // (12,1) is not collinear with (10,3) along any of the 6 hex directions.
    expect(evaluateCharge(state, cav, { q: 12, r: 1 })).toBeNull();
  });

  it('is not a charge when the destination is not adjacent to any enemy unit', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 });
    const state = makeState([cav]); // no enemy anywhere
    expect(evaluateCharge(state, cav, { q: 16, r: 3 })).toBeNull();
  });

  it('is not a charge for a unit that already spent some movement earlier this phase', () => {
    // Only 5 of the type's 6 points remain — the straight walk below spends
    // all of what's LEFT, but not the unit's full printed allowance.
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 5 });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 16, r: 3 } });
    const state = makeState([cav, enemy]);
    expect(evaluateCharge(state, cav, { q: 15, r: 3 })).toBeNull();
  });

  it('is never a charge for non-cavalry units, even under otherwise-identical conditions', () => {
    const infantry = makeCavalry({ typeId: 'fantassins', movementLeft: 3 }); // full allowance for fantassins
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 14, r: 3 } });
    const state = makeState([infantry, enemy]);
    // Distance 3, cost 3 — exactly the full allowance, straight line, adjacent to the enemy — but not cavalry.
    expect(evaluateCharge(state, infantry, { q: 13, r: 3 })).toBeNull();
  });

  // Regression for a bug an adversarial review caught: BoardScene was
  // deducting `reachableHexes`'s CHEAPEST-path cost even when charging,
  // rather than the straight-line cost this function computes — on hexes
  // where a detour around a river is cheaper than the direct line, that
  // granted a doubled attack while leaving movement unspent. These two
  // (start, destination) pairs are confirmed against the shipped
  // `src/data/map.ts`: both have a straight line strictly costlier than
  // `reachableHexes`'s cheapest path to the same hex, so this test would
  // have caught a caller that used the wrong number.
  it('returns the (costlier) straight-line cost even when a cheaper detour to the same hex exists — light cavalry crossing two river hexsides', () => {
    // (10,1)-(14,1) are all 'plain'; the straight line crosses river
    // hexsides at (11,1)|(12,1) and (12,1)|(13,1) (+1 move cost each),
    // for a straight-line total of 6 — exactly light cavalry's full
    // allowance. `reachableHexes` finds a cheaper 5-cost detour to the same
    // hex (confirmed via `reachableHexes` below), which must NOT be what
    // gets deducted for a charge.
    const cav = makeCavalry({ typeId: 'cavalerie-legere', position: { q: 10, r: 1 }, movementLeft: 6 });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 15, r: 1 } });
    const state = makeState([cav, enemy]);
    expect(reachableHexes(state, cav).get('14,1')).toBe(5); // the cheaper detour a naive caller might wrongly deduct
    expect(evaluateCharge(state, cav, { q: 14, r: 1 })).toBe(6);
  });

  it('returns the (costlier) straight-line cost even when a cheaper detour to the same hex exists — heavy cavalry through wide-river hexes', () => {
    // (20,4) and (20,3) are 'river-wide' terrain (move cost 3 each hex, no
    // forbidden-category restriction), (20,2) is 'plain': a straight-line
    // total of 3 + 1 = 4, exactly heavy cavalry's full allowance, while
    // `reachableHexes` finds a cheaper 3-cost detour around the wide river.
    const cav = makeCavalry({ typeId: 'cavalerie-lourde', position: { q: 20, r: 4 }, movementLeft: 4 });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 20, r: 1 } });
    const state = makeState([cav, enemy]);
    expect(reachableHexes(state, cav).get('20,2')).toBe(3); // the cheaper detour a naive caller might wrongly deduct
    expect(evaluateCharge(state, cav, { q: 20, r: 2 })).toBe(4);
  });

  // Regression for plan.md §8: a cavalry charge needs a straight line at
  // full movement allowance — before the fix, ANY friendly unit standing
  // anywhere on that line made the charge impossible, silently defeating
  // the feature. Reverting the `straightLineMoveCost` occupancy fix (i.e.
  // blocking on ANY occupant, not just an enemy/third-party one) makes this
  // fail: it would return `undefined` instead of `null` isn't the check —
  // rather `evaluateCharge` would return `null` here since the straight-line
  // cost becomes `undefined`.
  it('a charge succeeds through a friendly unit standing mid-line (traversal is allowed; only the destination must be empty)', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 }); // (10,3), full allowance
    const friendlyBlocker = makeCavalry({ typeId: 'fantassins', owner: 0, position: { q: 13, r: 3 } }); // mid-line
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 17, r: 3 } });
    const state = makeState([cav, friendlyBlocker, enemy]);
    // Same (start, destination) as the very first test in this describe
    // block — distance 6, adjacent to the enemy at (17,3) — but now with a
    // friendly unit sitting directly on the line at (13,3).
    expect(evaluateCharge(state, cav, { q: 16, r: 3 })).toBe(6);
  });
});

describe('reachableHexes — starting in enemy ZOC', () => {
  it('allows an elephant to leave enemy ZOC instead of freezing on its starting hex', () => {
    const elephant = makeCavalry({ id: 'elephant', typeId: 'elephants', owner: 0, position: { q: 6, r: 3 }, movementLeft: 4 });
    const enemies = [
      makeCavalry({ id: 'enemy-a', typeId: 'fantassins', owner: 1, position: { q: 5, r: 3 } }),
      makeCavalry({ id: 'enemy-b', typeId: 'fantassins', owner: 1, position: { q: 5, r: 4 } }),
      makeCavalry({ id: 'enemy-c', typeId: 'fantassins', owner: 1, position: { q: 5, r: 5 } }),
    ];
    const reachable = reachableHexes(makeState([elephant, ...enemies]), elephant);

    expect(reachable.get('7,2')).toBe(3); // steep-flank, legal for elephants, outside enemy ZOC
    expect(reachable.get('7,3')).toBe(1); // plain, outside enemy ZOC
    expect(reachable.has('6,2')).toBe(false); // still in enemy-a's ZOC
    expect(reachable.get('6,4')).toBe(2); // legal by first exiting through (7,3), then re-entering ZOC
  });

  it('does not allow a one-step shuffle directly within the same enemy ZOC', () => {
    const infantry = makeCavalry({ id: 'mover', typeId: 'fantassins', owner: 0, position: { q: 6, r: 3 }, movementLeft: 1 });
    const enemy = makeCavalry({ id: 'enemy', typeId: 'fantassins', owner: 1, position: { q: 5, r: 4 } });
    const reachable = reachableHexes(makeState([infantry, enemy]), infantry);

    expect(reachable.get('7,3')).toBe(1); // exit the enemy's ZOC
    expect(reachable.has('6,4')).toBe(false); // direct move within enemy's ZOC is forbidden
  });
});

describe('reachableHexes — moving through friendly units (plan.md §8)', () => {
  // French original (docs/research/05-rules-french-original.md:124-126):
  // "une unite ne peut en aucun cas se placer sur une case deja occupee par
  // une quelconque autre unite. Par contre, au cours d'un mouvement, une
  // unite peut traverser une case ou se trouve une unite de la meme armee."
  // A unit may never END its move on ANY occupied hex, but MAY pass through
  // one occupied by a unit of the SAME owner mid-move.

  it('traverses a friendly-occupied hex to reach a hex beyond it, but excludes the friendly hex itself as a destination', () => {
    const mover = makeCavalry({ typeId: 'fantassins', owner: 0, movementLeft: 3 }); // (10,3), full allowance
    const friendly = makeCavalry({ typeId: 'fantassins', owner: 0, position: { q: 11, r: 3 } });
    const state = makeState([mover, friendly]);
    const reachable = reachableHexes(state, mover);
    // (11,3) is occupied (by a friendly unit) — never a legal destination.
    expect(reachable.has('11,3')).toBe(false);
    // (12,3) and (13,3) are beyond the friendly unit, reached by walking
    // THROUGH (11,3) — reachable at the same cost as if it were empty.
    expect(reachable.get('12,3')).toBe(2);
    expect(reachable.get('13,3')).toBe(3);
  });

  // WHY THESE TWO TESTS USE RIVER GEOMETRY INSTEAD OF THE OPEN (10,3) ROW.
  //
  // The owner check is *normally unobservable* through `reachableHexes`, and
  // an earlier version of these tests was silently vacuous because of it.
  // Every unit with a different owner projects ZOC onto all six of its own
  // neighbours (`hexesUnderZoc`, combat.ts). To traverse such a unit you must
  // first enter one of those neighbours — which trips the ZOC-stop and ends
  // expansion before traversal is ever attempted. So on open ground, a
  // different-owner unit is already unreachable-through for reasons that have
  // nothing to do with the owner check, and mutating that check to
  // `if (false) continue;` (permitting traversal through literally anyone)
  // left the entire suite green. Moving the blocker further from the mover
  // does NOT fix this — it just relocates the same ZOC ring.
  //
  // The one place the check becomes observable is where ZOC is suppressed:
  // "les zones de contrôle ne « franchissent » pas les rivières"
  // (docs/research/05-rules-french-original.md:135), implemented by the
  // `riverBetween` skip in `hexesUnderZoc`. (1,20) and (2,20) are plain hexes
  // separated by a river hexside on the shipped map, so a unit standing on
  // (1,20) casts no ZOC onto (2,20) — the mover can sit there un-frozen and
  // actually attempt the traversal. (1,19) is reachable ONLY through (1,20).
  // If either test starts passing regardless of the owner check, this
  // geometry has been broken; re-derive it rather than deleting the test.
  it('does NOT traverse a hex occupied by a different owner, even in a 3+ player game where that owner isn\'t the active player\'s declared enemy — "meme armee" means same owner, not merely "not enemy"', () => {
    const mover = makeCavalry({ typeId: 'fantassins', owner: 0, movementLeft: 3, position: { q: 2, r: 20 } });
    const thirdParty = makeCavalry({ typeId: 'fantassins', owner: 2, position: { q: 1, r: 20 } });
    const reachable = reachableHexes(makeState([mover, thirdParty]), mover);
    expect(reachable.has('1,20')).toBe(false); // occupied — never a destination
    // Blocked outright, not traversed. Swap `owner: 2` for `owner: 0` below
    // and (1,19) becomes reachable at cost 3 — that contrast IS the rule.
    expect(reachable.has('1,19')).toBe(false);

    // Control: the identical position with a SAME-OWNER unit traverses fine,
    // proving the block above is the owner check and not the river, the
    // terrain, or the movement budget.
    const controlMover = makeCavalry({ typeId: 'fantassins', owner: 0, movementLeft: 3, position: { q: 2, r: 20 } });
    const friendly = makeCavalry({ typeId: 'fantassins', owner: 0, position: { q: 1, r: 20 } });
    const control = reachableHexes(makeState([controlMover, friendly]), controlMover);
    expect(control.get('1,19')).toBe(3);
  });

  it('still blocks entry outright on an enemy-occupied hex (unchanged prior behavior)', () => {
    const mover = makeCavalry({ typeId: 'fantassins', owner: 0, movementLeft: 3, position: { q: 2, r: 20 } });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 1, r: 20 } });
    const reachable = reachableHexes(makeState([mover, enemy]), mover);
    expect(reachable.has('1,20')).toBe(false);
    expect(reachable.has('1,19')).toBe(false);
  });

  // Design question 3 (plan.md §8.3): passing THROUGH a friendly unit that
  // itself sits inside an enemy ZOC must still trigger the independent
  // "must stop on entering an enemy ZOC" rule — traversal doesn't grant
  // immunity to the ZOC-stop rule for hexes further down the line.
  it('a friendly-occupied hex inside an enemy ZOC still cuts off further traversal beyond it', () => {
    // Deliberate geometry, and it took some care to make this test capable of
    // failing. The enemy sits at (13,2), NOT (13,3): (13,2)'s ZOC covers the
    // friendly's hex (12,3) but NOT the approach hex (11,3), so the mover can
    // still walk up to the friendly. Movement is capped at 3 so the go-around
    // route (via 12,4, cost 4) is out of budget — making (13,3) reachable ONLY
    // by continuing through (12,3). If the ZOC-stop rule were skipped for
    // occupied hexes, (12,3) would be entered at cost 2 and expansion would
    // continue to (13,3) at cost 3. It must not.
    const mover = makeCavalry({ typeId: 'fantassins', owner: 0, movementLeft: 3 }); // (10,3)
    const friendlyInZoc = makeCavalry({ typeId: 'fantassins', owner: 0, position: { q: 12, r: 3 } });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 13, r: 2 } });
    const reachable = reachableHexes(makeState([mover, friendlyInZoc, enemy]), mover);
    expect(reachable.get('11,3')).toBe(1); // short of the friendly/ZOC hex: fine
    expect(reachable.has('12,3')).toBe(false); // occupied: never a destination
    // The load-bearing assertion — traversal does NOT grant ZOC immunity.
    expect(reachable.has('13,3')).toBe(false);

    // Control: remove ONLY the enemy and the very same traversal succeeds at
    // cost 3, proving the assertion above is the ZOC rule biting and not the
    // mover simply running out of movement or the friendly blocking outright.
    const controlMover = makeCavalry({ typeId: 'fantassins', owner: 0, movementLeft: 3 });
    const controlFriendly = makeCavalry({ typeId: 'fantassins', owner: 0, position: { q: 12, r: 3 } });
    const control = reachableHexes(makeState([controlMover, controlFriendly]), controlMover);
    expect(control.get('13,3')).toBe(3);
  });
});
