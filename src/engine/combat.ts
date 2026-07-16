import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, RIVER_HEXSIDES, riverEdgeKey, hexKey as mapHexKey } from '../data/map';
import { TERRAIN_EFFECTS, RIVER_CROSSING, type TerrainType } from '../data/terrain';
import { resolveLandCombat, type CombatResult } from '../data/combatTable';
import { isRammingSuccessful, type ShipTypeId } from '../data/navalRamming';
import { resolveBoarding, type BoardingResult } from '../data/navalBoarding';
import { directionForDie, hexAdd, hexEquals, traceLine, DIRECTIONS } from './hex';
import {
  type GameState,
  type Unit,
  unitType,
  currentAttack,
  currentDefense,
} from './state';

export function terrainAt(hex: HexCoord): TerrainType {
  return MAP_TERRAIN.get(mapHexKey(hex.q, hex.r)) ?? 'plain';
}

/** True if a (normal) river runs along the hexside shared by two adjacent hexes. */
export function riverBetween(a: HexCoord, b: HexCoord): boolean {
  return RIVER_HEXSIDES.has(riverEdgeKey(a, b));
}

export function unitAt(state: GameState, hex: HexCoord): Unit | undefined {
  return state.units.find((u) => !u.destroyed && hexEquals(u.position, hex));
}

/** Land combat: sums attack/defense, applies the defending hex's terrain
 * modifier to the attacker's die roll, and looks up the CRT. */
export function resolveLandAttack(
  attackers: Unit[],
  defenders: Unit[],
  rawDieRoll: number,
): CombatResult {
  const attackForce = attackers.reduce((sum, u) => sum + currentAttack(u), 0);
  const defenseForce = defenders.reduce((sum, u) => sum + currentDefense(u), 0);

  const defenderHex = defenders[0]!.position;
  const terrain = TERRAIN_EFFECTS[terrainAt(defenderHex)];
  // "+2 if the attackers come from below" is approximated as: apply the
  // conditional bonus whenever any attacker's own hex is not the same
  // elevated terrain type as the defender's (i.e. attacking up onto it).
  let modifier = terrain.combatModifier;
  if (terrain.conditionalOnAttackingFromBelow) {
    const attackerTerrain = terrainAt(attackers[0]!.position);
    modifier = attackerTerrain === terrainAt(defenderHex) ? 0 : terrain.combatModifier;
  }

  // Attacking across a river hexside gives the defender a bonus. Apply it if
  // any adjacent attacker crosses a river to reach the defender.
  const acrossRiver = attackers.some((a) => riverBetween(a.position, defenderHex));
  if (acrossRiver) modifier += RIVER_CROSSING.combatModifier;

  const dieRoll = rawDieRoll + modifier;
  return resolveLandCombat(attackForce, defenseForce, dieRoll);
}

export interface RangedCheck {
  canAttack: boolean;
  reason?: string;
}

/** Ranged units may only fire at EXACTLY their listed range; melee units need adjacency. */
export function checkRangedEligibility(attacker: Unit, distance: number): RangedCheck {
  const t = unitType(attacker);
  if (distance === 1) {
    if (t.meleeCapable) return { canAttack: true };
    return { canAttack: false, reason: `${t.name} cannot fight in melee` };
  }
  if (t.rangedAttack > 0 && distance === t.range) {
    return { canAttack: true };
  }
  return { canAttack: false, reason: `${t.name} can only fire at exactly ${t.range} hexes` };
}

/**
 * Elephant stampede: instead of retreating, roll a d6 for direction and
 * career in a straight line for the elephant's full movement allowance,
 * damaging every unit (friend or foe) encountered, until it leaves the map
 * or is destroyed. Returns the hexes it passed through and any units hit.
 */
export interface StampedeResult {
  path: HexCoord[];
  unitsHit: Unit[];
  exitedMap: boolean;
}

export function resolveElephantStampede(
  elephant: Unit,
  dieRoll: number,
  allUnits: Unit[],
  isOnMap: (hex: HexCoord) => boolean = (hex) => MAP_TERRAIN.has(mapHexKey(hex.q, hex.r)),
): StampedeResult {
  const direction = directionForDie(dieRoll);
  const t = unitType(elephant);
  const path = traceLine(elephant.position, direction, t.movement);
  const unitsHit: Unit[] = [];
  let exitedMap = false;
  let finalPosition = elephant.position;

  for (const hex of path) {
    if (!isOnMap(hex)) {
      exitedMap = true;
      break;
    }
    const occupant = allUnits.find((u) => !u.destroyed && u.id !== elephant.id && hexEquals(u.position, hex));
    if (occupant) unitsHit.push(occupant);
    finalPosition = hex;
  }

  elephant.position = finalPosition;
  return { path, unitsHit, exitedMap };
}

/** Zone of control: every land unit projects into its 6 neighbors, except
 * ships (no ZOC) and across river hexsides (a ZOC does not cross a river,
 * per the rules: "les zones de contrôle ne franchissent pas les rivières"). */
export function hexesUnderZoc(state: GameState, forOwner: number): Set<string> {
  const zocHexes = new Set<string>();
  for (const unit of state.units) {
    if (unit.destroyed || unit.owner === forOwner) continue;
    const t = unitType(unit);
    if (t.domain === 'naval') continue;
    for (const dir of DIRECTIONS) {
      const neighborHex = hexAdd(unit.position, dir);
      const terrain = MAP_TERRAIN.get(mapHexKey(neighborHex.q, neighborHex.r));
      if (terrain === undefined) continue; // off the map
      if (riverBetween(unit.position, neighborHex)) continue; // ZOC blocked by river
      zocHexes.add(mapHexKey(neighborHex.q, neighborHex.r));
    }
  }
  return zocHexes;
}

export function isRammingHit(attackerType: ShipTypeId, defenderType: ShipTypeId, dieRoll: number): boolean {
  return isRammingSuccessful(attackerType, defenderType, dieRoll);
}

export function resolveNavalBoarding(attackForce: number, defenseForce: number, dieRoll: number): BoardingResult {
  return resolveBoarding(attackForce, defenseForce, dieRoll);
}
