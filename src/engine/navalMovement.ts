import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, hexKey as mapHexKey } from '../data/map';
import { TERRAIN_EFFECTS, canEnterTerrain } from '../data/terrain';
import { rammingBonusFromUnusedMovement } from '../data/navalRamming';
import { hexAdd, hexKey, DIRECTIONS } from './hex';
import { unitAt } from './combat';
import type { GameState, Unit } from './state';
import { unitType } from './state';

function stateKey(hex: HexCoord, facing: number): string {
  return `${hexKey(hex)}|${facing}`;
}

export interface NavalState {
  hex: HexCoord;
  facing: number;
  /** Movement points spent to reach this (hex, facing) combination. */
  cost: number;
}

/**
 * Every (hex, facing) combination a ship can reach with its remaining
 * movement, via any interleaving of rotation (1 point per 60° turn, either
 * direction) and forward moves (a ship may only leave a hex through the
 * side its bow faces, at the entered hex's terrain cost). Unlike land units,
 * ships project and respect no zone of control, so there's no "must stop on
 * contact" rule here — the caller (`findRammingContacts`) decides what
 * "contact" means for ramming.
 *
 * Dijkstra over the tiny (hex × 6 facings) state graph — no priority queue
 * needed at this scale, a re-sorted array is plenty.
 *
 * RULING (plan.md §8.3) — ships do NOT get the land "may traverse a
 * friendly-occupied hex mid-move" exception: `forwardHex` below stays fully
 * impassable whenever ANY unit occupies it, friendly or not, unlike land's
 * `reachableHexes`. Kept naval movement as-is deliberately, for two reasons:
 *   1. The traversal passage sits in the rulebook's general/land movement
 *      section (`05-rules-french-original.md:124-126`); naval movement and
 *      combat get their own separate section (facing, ramming, boarding)
 *      that never restates or alludes to it, so extending it to ships is an
 *      addition to the text, not a reading of it.
 *   2. Mechanically it doesn't fit this state graph without real risk: every
 *      node this function returns is treated elsewhere (`reachableNavalHexes`,
 *      `findRammingContacts`) as a real, occupiable (hex, facing) the ship
 *      could actually be declaring a ram from — not merely a waypoint on a
 *      path, the way a land hex is just an entry in `costSoFar`. Letting a
 *      ship's state "pass through" a hex a friendly ship already physically
 *      occupies would mean treating that hex as simultaneously
 *      double-occupied for ramming-contact purposes, which is a much sharper
 *      version of the stacking hazard land's fix had to guard against (see
 *      `reachableHexes` in `movement.ts`), for a maneuver (hull-to-hull
 *      passage) galleys in this period's line-abreast tactics rarely needed.
 * If this is ever revisited, it needs its own destination/traversal split
 * mirroring `reachableHexes`'s, with ramming contacts still confined to
 * genuinely reachable STOPPING states.
 */
export function reachableNavalStates(state: GameState, unit: Unit): Map<string, NavalState> {
  const isGalley = unit.typeId === 'galeres';
  const start: NavalState = { hex: unit.position, facing: unit.facing, cost: 0 };
  const best = new Map<string, NavalState>([[stateKey(start.hex, start.facing), start]]);
  const queue: NavalState[] = [start];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (best.get(stateKey(current.hex, current.facing))!.cost < current.cost) continue; // superseded

    const candidates: NavalState[] = [
      { hex: current.hex, facing: (current.facing + 1) % 6, cost: current.cost + 1 },
      { hex: current.hex, facing: (current.facing + 5) % 6, cost: current.cost + 1 },
    ];

    const forwardHex = hexAdd(current.hex, DIRECTIONS[current.facing]!);
    const terrain = MAP_TERRAIN.get(mapHexKey(forwardHex.q, forwardHex.r));
    if (terrain !== undefined && canEnterTerrain(terrain, 'naval', isGalley)) {
      const occupant = unitAt(state, forwardHex);
      if (!occupant || occupant.id === unit.id) {
        candidates.push({ hex: forwardHex, facing: current.facing, cost: current.cost + TERRAIN_EFFECTS[terrain].moveCost });
      }
    }

    for (const candidate of candidates) {
      if (candidate.cost > unit.movementLeft) continue;
      const key = stateKey(candidate.hex, candidate.facing);
      const existing = best.get(key);
      if (!existing || candidate.cost < existing.cost) {
        best.set(key, candidate);
        queue.push(candidate);
      }
    }
  }

  return best;
}

/**
 * The cheapest way to reach each hex at all (regardless of ending facing),
 * for UI hex-highlighting and as the naval counterpart to the land
 * `reachableHexes`. Ties between facings that cost the same are broken
 * arbitrarily — the rulebook has no preference between them. Excludes the
 * ship's own starting hex.
 */
export function reachableNavalHexes(state: GameState, unit: Unit): Map<string, { cost: number; facing: number }> {
  const startKey = hexKey(unit.position);
  const byHex = new Map<string, { cost: number; facing: number }>();
  for (const s of reachableNavalStates(state, unit).values()) {
    const hKey = hexKey(s.hex);
    if (hKey === startKey) continue;
    const existing = byHex.get(hKey);
    if (!existing || s.cost < existing.cost) byHex.set(hKey, { cost: s.cost, facing: s.facing });
  }
  return byHex;
}

export interface RammingContact {
  hex: HexCoord;
  facing: number;
  cost: number;
  bonus: 0 | 1 | 2;
  target: Unit;
}

/**
 * Every reachable (hex, facing) state — including the ship's starting spot,
 * if already bow-on to an enemy — from which this ship's bow points directly
 * at an adjacent enemy ship: a ramming opportunity ("une tentative
 * d'éperonnage a lieu quand, au cours de sa phase de déplacement, un
 * vaisseau rencontre sur sa trajectoire un vaisseau ennemi"). The bonus
 * reflects how much movement would be left unspent by declaring the ram at
 * that point (see `rammingBonusFromUnusedMovement`) — a rational player
 * declares at the first (cheapest) contact to keep the bonus as high as
 * possible, but every reachable contact point is reported so the caller can
 * decide.
 */
export function findRammingContacts(state: GameState, unit: Unit): RammingContact[] {
  const contacts: RammingContact[] = [];
  for (const s of reachableNavalStates(state, unit).values()) {
    const bowHex = hexAdd(s.hex, DIRECTIONS[s.facing]!);
    const target = unitAt(state, bowHex);
    if (!target || target.destroyed || target.owner === unit.owner) continue;
    if (unitType(target).domain !== 'naval') continue;
    contacts.push({
      hex: s.hex,
      facing: s.facing,
      cost: s.cost,
      bonus: rammingBonusFromUnusedMovement(unit.movementLeft - s.cost),
      target,
    });
  }
  return contacts;
}
