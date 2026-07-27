import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, hexKey as mapHexKey } from '../data/map';
import { TERRAIN_EFFECTS, RIVER_CROSSING, canEnterTerrain } from '../data/terrain';
import { getUnitType } from '../data/units';
import { hexKey, neighbors } from './hex';
import { hexesUnderZoc, unitAt, terrainAt, riverBetween } from './combat';
import { reachableNavalHexes } from './navalMovement';
import type { GameState, Unit } from './state';

export { reachableNavalHexes, reachableNavalStates, findRammingContacts } from './navalMovement';
export type { NavalState, RammingContact } from './navalMovement';

/** The `canEnterTerrain` category a unit type falls into — exported so
 * placement (which has a typeId but no `Unit` yet, nothing's been placed)
 * can run the same terrain-access check as movement does. */
export function unitCategory(typeId: string): 'chariot' | 'cavalry' | 'elephant' | 'land' | 'naval' {
  const t = getUnitType(typeId);
  if (t.domain === 'naval') return 'naval';
  if (t.id.startsWith('chars-')) return 'chariot';
  if (t.id.startsWith('cavalerie-')) return 'cavalry';
  if (t.id === 'elephants') return 'elephant';
  return 'land';
}

/**
 * Computes every hex reachable by `unit` given its remaining movement,
 * respecting terrain cost/restrictions and the "must stop on entering an
 * enemy ZOC" rule. Returns a map of hexKey -> movement points spent to
 * reach it (for UI display), not including impassable/unreached hexes.
 *
 * Naval units delegate to `reachableNavalHexes`, which additionally tracks
 * facing (a ship may only move forward through the side its bow faces, and
 * rotating costs movement points) — this wrapper just drops the facing from
 * the result for callers that only care about which hexes are reachable at
 * all. Use `reachableNavalHexes` directly when the ending facing matters.
 */
export function reachableHexes(state: GameState, unit: Unit): Map<string, number> {
  const category = unitCategory(unit.typeId);
  if (category === 'naval') {
    const naval = reachableNavalHexes(state, unit);
    return new Map(Array.from(naval, ([key, { cost }]) => [key, cost]));
  }
  const isGalley = unit.typeId === 'galeres';
  const enemyZoc = hexesUnderZoc(state, unit.owner);
  const startKey = hexKey(unit.position);

  const costSoFar = new Map<string, number>([[startKey, 0]]);
  const frontier: HexCoord[] = [unit.position];
  const startedInZoc = enemyZoc.has(startKey);

  while (frontier.length > 0) {
    const current = frontier.shift()!;
    const currentKey = hexKey(current);
    const spent = costSoFar.get(currentKey)!;

    // A unit that just entered an enemy ZOC must stop — no further expansion.
    if (currentKey !== startKey && enemyZoc.has(currentKey)) continue;
    // A unit that began its move inside an enemy ZOC may not shuffle to
    // another hex still within that same ZOC without first leaving it.
    if (currentKey === startKey && startedInZoc) continue;

    for (const next of neighbors(current)) {
      const nextKey = hexKey(next);
      const terrain = MAP_TERRAIN.get(mapHexKey(next.q, next.r));
      if (terrain === undefined) continue; // off the map
      if (!canEnterTerrain(terrain, category, isGalley)) continue;
      if (unitAt(state, next)) continue; // hexes may hold at most one unit

      let moveCost = TERRAIN_EFFECTS[terrain].moveCost;
      // Crossing a river hexside costs extra (naval movement is handled
      // separately above and never reaches this branch).
      if (riverBetween(current, next)) {
        moveCost += RIVER_CROSSING.extraMoveCost;
      }
      const newCost = spent + moveCost;
      if (newCost > unit.movementLeft) continue;

      const existing = costSoFar.get(nextKey);
      if (existing === undefined || newCost < existing) {
        costSoFar.set(nextKey, newCost);
        frontier.push(next);
      }
    }
  }

  costSoFar.delete(startKey);
  return costSoFar;
}

export function terrainMoveCost(hex: HexCoord): number {
  return TERRAIN_EFFECTS[terrainAt(hex)].moveCost;
}
