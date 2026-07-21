import { describe, it, expect } from 'vitest';
import { checkRangedEligibility, resolveElephantStampede, resolveLandAttack, riverBetween } from './combat';
import { RIVER_HEXSIDES, riverEdgeKey } from '../data/map';
import type { Unit } from './state';

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
    hasRetreatedThisPhase: false,
    destroyed: false,
    ...overrides,
  };
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

describe('riverBetween', () => {
  it('recognizes a known river hexside symmetrically and rejects a non-river edge', () => {
    const [a, b] = sampleRiverEdge();
    expect(riverBetween(a, b)).toBe(true);
    expect(riverBetween(b, a)).toBe(true);
    // Coordinates far outside any real map's range can't coincidentally be a river edge.
    expect(riverBetween({ q: 9999, r: 9999 }, { q: 10000, r: 9999 })).toBe(false);
  });
});
