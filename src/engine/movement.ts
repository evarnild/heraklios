import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, hexKey as mapHexKey } from '../data/map';
import { TERRAIN_EFFECTS, RIVER_CROSSING, canEnterTerrain } from '../data/terrain';
import { getUnitType } from '../data/units';
import { hexKey, hexAdd, hexEquals, hexDistance, neighbors, DIRECTIONS } from './hex';
import { hexesUnderZoc, unitAt, terrainAt, riverBetween } from './combat';
import { reachableNavalHexes } from './navalMovement';
import { unitCategory, type GameState, type Unit } from './state';

export { reachableNavalHexes, reachableNavalStates, findRammingContacts } from './navalMovement';
export type { NavalState, RammingContact } from './navalMovement';

/** The `canEnterTerrain` category a unit type falls into — re-exported from
 * `engine/state.ts` (its actual home, chosen to avoid a `combat.ts` <->
 * `movement.ts` import cycle — see the doc comment there) so placement
 * (which has a typeId but no `Unit` yet, nothing's been placed) and existing
 * tests can keep importing it from here. */
export { unitCategory };

function enemyZocProjectorsForHex(state: GameState, owner: number, hex: HexCoord): Set<string> {
  const projectors = new Set<string>();
  for (const enemy of state.units) {
    if (enemy.destroyed || enemy.owner === owner) continue;
    if (getUnitType(enemy.typeId).domain === 'naval') continue;
    if (hexDistance(enemy.position, hex) !== 1) continue;
    if (riverBetween(enemy.position, hex)) continue;
    projectors.add(enemy.id);
  }
  return projectors;
}

function sharesAnyProjector(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const id of a) {
    if (b.has(id)) return true;
  }
  return false;
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
 *
 * TRAVERSAL VS. TERMINATION (see `docs/research/05-rules-french-original.md:
 * 124-126`): "une unité ne peut en aucun cas se placer sur une case déjà
 * occupée par une quelconque autre unité. Par contre, au cours d'un
 * mouvement, une unité peut traverser une case où se trouve une unité de la
 * même armée" — a unit may never END its move on any occupied hex, but MAY
 * pass through a hex occupied by a unit of the SAME ARMY mid-move. "Même
 * armée" is read literally as same `owner`, not merely "not an enemy" — in
 * a 3-4 player hotseat game each player is a distinct army, so a unit must
 * not be able to traverse a third party's units just because that party
 * isn't presently at war with the mover. The BFS below therefore expands
 * THROUGH friendly-occupied hexes (tracking cost as normal, so a charge or
 * a long march isn't blocked by a friendly line) while still excluding
 * every currently-occupied hex — friendly or not — from the returned
 * destination map, preserving the "every key is a legal landing spot"
 * contract every caller (`BoardScene`, `actions.ts`'s `legalActions`/
 * `applyAction`, the fuzz harness) already relies on. Enemy-occupied hexes
 * remain fully impassable, exactly as before.
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
  // Hexes reached above that are occupied (necessarily by a friendly unit —
  // an enemy-occupied hex is never entered into `costSoFar` at all) and so
  // must be stripped from the returned destination map at the end, even
  // though they were legitimately traversed to compute cost beyond them.
  const occupiedKeys = new Set<string>();
  const frontier: HexCoord[] = [unit.position];
  const startZocProjectors = enemyZocProjectorsForHex(state, unit.owner, unit.position);

  while (frontier.length > 0) {
    const current = frontier.shift()!;
    const currentKey = hexKey(current);
    const spent = costSoFar.get(currentKey)!;

    // A unit that just entered an enemy ZOC must stop — no further expansion.
    if (currentKey !== startKey && enemyZoc.has(currentKey)) continue;

    for (const next of neighbors(current)) {
      const nextKey = hexKey(next);
      const terrain = MAP_TERRAIN.get(mapHexKey(next.q, next.r));
      if (terrain === undefined) continue; // off the map
      if (!canEnterTerrain(terrain, category, isGalley)) continue;
      // A unit that begins in enemy ZOC may leave it, but may not move
      // directly to another hex controlled by any of the same enemy units.
      if (
        currentKey === startKey &&
        startZocProjectors.size > 0 &&
        sharesAnyProjector(startZocProjectors, enemyZocProjectorsForHex(state, unit.owner, next))
      ) {
        continue;
      }
      const occupant = unitAt(state, next);
      // An enemy (or third-party, in a 3-4 player game) unit blocks entry
      // outright. A friendly unit (same owner) may be traversed mid-move —
      // it's tracked into `occupiedKeys` below so it's excluded from the
      // final destination set instead.
      if (occupant && occupant.owner !== unit.owner) continue;

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
        // Occupancy is a property of the hex, not of the path taken to
        // reach it, so this is idempotent across re-discoveries of `next`.
        if (occupant) occupiedKeys.add(nextKey);
      }
    }
  }

  costSoFar.delete(startKey);
  for (const key of occupiedKeys) costSoFar.delete(key);
  return costSoFar;
}

export function terrainMoveCost(hex: HexCoord): number {
  return TERRAIN_EFFECTS[terrainAt(hex)].moveCost;
}

/**
 * DESIGN NOTE — how charge eligibility is detected (see `evaluateCharge`
 * below, and `Unit.charged` in `engine/state.ts`):
 *
 * `reachableHexes` above is a BFS/Dijkstra hybrid that returns only
 * `Map<hexKey, cost>` — the cheapest cost to reach each hex, not *how* the
 * unit got there. A charge ("uses its full movement allowance in a straight
 * line and ends adjacent to an enemy unit") needs the actual path, not just
 * the destination, so one of two things has to give:
 *
 *   (a) Track parent pointers through `reachableHexes`'s BFS and reconstruct
 *       the path to whatever hex the player eventually clicks; or
 *   (b) Recompute, independently, whether a *specific* straight-line path
 *       from the unit's start-of-move hex to the clicked destination is both
 *       legal and exactly exhausts the unit's movement allowance.
 *
 * (b) is what's implemented here. Reasons:
 *   - The UI (`BoardScene.onHexClick`) is a single click straight to a
 *     destination hex, computed against `reachableHexes`'s cheapest-cost
 *     map — there's no click-by-click path for the engine to observe, so a
 *     "note the path as the player walks it" approach doesn't fit this
 *     game's movement UI at all.
 *   - BFS parent-pointer reconstruction would only recover the ONE path the
 *     algorithm happened to keep (ties broken arbitrarily by traversal
 *     order — see `existing === undefined || newCost < existing` above), not
 *     necessarily a straight one, even when a same-cost straight path to
 *     that same hex also exists. Reconstructing forces `reachableHexes`
 *     itself to start tracking parents/directions purely to serve this one
 *     caller, complicating its cheapest-path contract for every other user
 *     (naval movement, placement, the reachable-hex highlight).
 *   - A charge is really a question about ONE specific candidate hex ("is
 *     THIS destination reachable by a straight full-allowance walk?"), which
 *     `straightLineMoveCost` below answers directly and cheaply, without
 *     needing to enumerate or compare every other path to every other hex.
 *
 * A unit that had already partially moved earlier in the same Movement phase
 * (so `unit.movementLeft` is less than its full allowance) can never charge
 * on a later move even if that later move happens to be a straight,
 * fully-remaining-movement walk: the rulebook's "emploie son potentiel de
 * déplacement au maximum" (uses its movement potential AT MAXIMUM) is read
 * literally here as spending the unit's ENTIRE printed allowance in that one
 * straight walk, not merely whatever was left after an earlier, unrelated
 * move. `evaluateCharge` enforces this by requiring `unit.movementLeft`
 * (before the move) to equal the type's full `movement` stat.
 */

/**
 * The single direction (from `hex.ts`'s `DIRECTIONS`) that, repeated
 * `hexDistance(from, to)` times, walks from `from` to `to` — or `undefined`
 * if the two hexes aren't collinear along one of the 6 hex directions (or
 * are the same hex).
 */
function straightLineDirection(from: HexCoord, to: HexCoord): HexCoord | undefined {
  const distance = hexDistance(from, to);
  if (distance === 0) return undefined;
  return DIRECTIONS.find((dir) => hexEquals(hexAdd(from, { q: dir.q * distance, r: dir.r * distance }), to));
}

/**
 * The movement-point cost of walking `unit` from its current position to
 * `destination` along a single straight hex-line (see `straightLineDirection`),
 * applying the exact same terrain/occupancy/ZOC-stop rules `reachableHexes`
 * does — or `undefined` if `destination` isn't reachable that way at all
 * (not collinear, off the map, blocked terrain, occupied at the destination,
 * an enemy/third-party unit anywhere on the line, or would require passing
 * through — not just stopping on — an enemy ZOC hex).
 *
 * Mid-line hexes occupied by a FRIENDLY unit (same `owner` — see the design
 * note on `reachableHexes` above) are traversable, matching that function;
 * the destination hex itself must still be unoccupied by anyone, since a
 * unit may never end its move on an occupied hex regardless of who's there.
 */
function straightLineMoveCost(state: GameState, unit: Unit, destination: HexCoord): number | undefined {
  const direction = straightLineDirection(unit.position, destination);
  if (!direction) return undefined;
  const category = unitCategory(unit.typeId);
  if (category === 'naval') return undefined; // naval facing/rotation isn't a straight walk in this sense; charges are land-only anyway (see evaluateCharge)
  const isGalley = unit.typeId === 'galeres';
  const enemyZoc = hexesUnderZoc(state, unit.owner);
  const startZocProjectors = enemyZocProjectorsForHex(state, unit.owner, unit.position);

  const distance = hexDistance(unit.position, destination);
  let current = unit.position;
  let cost = 0;
  for (let step = 1; step <= distance; step++) {
    const next = hexAdd(current, direction);
    const terrain = MAP_TERRAIN.get(mapHexKey(next.q, next.r));
    if (terrain === undefined) return undefined; // off the map
    if (!canEnterTerrain(terrain, category, isGalley)) return undefined;
    if (
      step === 1 &&
      startZocProjectors.size > 0 &&
      sharesAnyProjector(startZocProjectors, enemyZocProjectorsForHex(state, unit.owner, next))
    ) {
      return undefined;
    }
    const isFinalStep = step === distance;
    const occupant = unitAt(state, next);
    if (isFinalStep) {
      if (occupant) return undefined; // may never END a move on any occupied hex
    } else if (occupant && occupant.owner !== unit.owner) {
      return undefined; // an enemy/third-party unit blocks the line outright
    }

    let moveCost = TERRAIN_EFFECTS[terrain].moveCost;
    if (riverBetween(current, next)) moveCost += RIVER_CROSSING.extraMoveCost;
    cost += moveCost;

    // A unit that enters an enemy ZOC hex must stop there — a straight walk
    // can only pass through one if it's the final (destination) hex.
    if (!isFinalStep && enemyZoc.has(hexKey(next))) return undefined;

    current = next;
  }
  return cost;
}

/**
 * Whether moving `unit` (still at its pre-move position) to `destination`
 * qualifies as a cavalry charge: the unit is cavalry, the move spends its
 * ENTIRE movement allowance walking a single straight hex-line to
 * `destination`, and `destination` ends adjacent to at least one enemy unit.
 * See the design note above `straightLineDirection` for why this is computed
 * directly rather than by reconstructing a path out of `reachableHexes`.
 *
 * Returns the movement-point cost to deduct for a qualifying charge (by
 * construction this always equals the unit's full allowance — a charge only
 * qualifies when the straight-line cost exactly exhausts it, see below — but
 * returning the cost rather than `true` makes that contract explicit at the
 * call site instead of implicit), or `null` if the move isn't a charge.
 *
 * IMPORTANT: the straight-line cost computed here can differ from
 * `reachableHexes`'s cheapest-path cost to the same hex whenever a detour
 * (e.g. avoiding a river-crossing surcharge) is cheaper than a direct line —
 * on the shipped map this really happens (e.g. light cavalry from (10,1) to
 * (14,1): straight cost 6, cheapest 5). Callers MUST deduct THIS function's
 * returned cost when charging, not `reachableHexes`'s cheaper cost — using
 * the cheaper cost would grant the doubled attack while leaving unspent
 * movement, contradicting "emploie son potentiel de déplacement au maximum."
 *
 * Callers (`BoardScene`) should call this BEFORE mutating `unit.position` /
 * `unit.movementLeft`: on a non-null result, deduct the returned cost (not
 * `reachableHexes`'s cost) and set `unit.charged = true`; otherwise fall
 * back to `reachableHexes`'s cheapest-path cost for an ordinary move. See
 * `Unit.charged`'s doc comment in `engine/state.ts` for the field's lifecycle.
 */
export function evaluateCharge(state: GameState, unit: Unit, destination: HexCoord): number | null {
  if (unitCategory(unit.typeId) !== 'cavalry') return null;
  const fullAllowance = getUnitType(unit.typeId).movement;
  if (unit.movementLeft !== fullAllowance) return null; // already spent some movement this phase
  const cost = straightLineMoveCost(state, unit, destination);
  if (cost === undefined || cost !== fullAllowance) return null; // must exactly exhaust the allowance
  const endsAdjacentToEnemy = neighbors(destination).some((hex) => {
    const occupant = unitAt(state, hex);
    return occupant !== undefined && occupant.owner !== unit.owner;
  });
  return endsAdjacentToEnemy ? cost : null;
}
