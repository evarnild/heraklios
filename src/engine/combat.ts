import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, RIVER_HEXSIDES, riverEdgeKey, hexKey as mapHexKey } from '../data/map';
import { TERRAIN_EFFECTS, RIVER_CROSSING, type TerrainType } from '../data/terrain';
import { resolveLandCombat, ratioToColumnIndex, RATIO_COLUMNS, type CombatResult } from '../data/combatTable';
import { isRammingSuccessful, type ShipTypeId } from '../data/navalRamming';
import { resolveBoarding, type BoardingResult } from '../data/navalBoarding';
import { directionForDie, hexAdd, hexDistance, hexEquals, traceLine, DIRECTIONS } from './hex';
import {
  type GameState,
  type Unit,
  type CombatMode,
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

/**
 * Land combat: sums attack/defense across every attacker/defender, applies
 * a terrain modifier to the attacker's die roll, and looks up the CRT.
 *
 * With multiple defenders (possible in 'multi-defender' combat mode, or
 * naturally never in 'single-defender' mode where `defenders` is always
 * length 1), the terrain modifier uses the worst case for the attacker
 * across all defenders' hexes, and the river-crossing bonus applies if ANY
 * attacker crosses a river to reach ANY defender — both are the natural
 * generalization of the single-defender rule, favoring the defense the way
 * the original rule's single-hex lookup did.
 */
export interface LandAttackDetail {
  attackForce: number;
  defenseForce: number;
  /** Force-ratio column label, e.g. "4-1" (see `RATIO_COLUMNS`). */
  ratioLabel: string;
  terrainModifier: number;
  rawDieRoll: number;
  /** `rawDieRoll + terrainModifier`, before the [1,6] clamp the CRT applies. */
  modifiedDieRoll: number;
  result: CombatResult;
}

function computeLandAttackDetail(
  attackers: Unit[],
  defenders: Unit[],
  rawDieRoll: number,
): LandAttackDetail {
  const attackForce = attackers.reduce((sum, u) => sum + currentAttack(u), 0);
  const defenseForce = defenders.reduce((sum, u) => sum + currentDefense(u), 0);

  let modifier = 0;
  let acrossRiver = false;
  for (const defender of defenders) {
    const defenderTerrain = terrainAt(defender.position);
    const terrain = TERRAIN_EFFECTS[defenderTerrain];
    // "+2 if the attackers come from below" is approximated as: apply the
    // conditional bonus whenever any attacker's own hex is not the same
    // elevated terrain type as this defender's (i.e. attacking up onto it).
    let defenderModifier = terrain.combatModifier;
    if (terrain.conditionalOnAttackingFromBelow) {
      const attackingFromBelow = attackers.some((a) => terrainAt(a.position) !== defenderTerrain);
      defenderModifier = attackingFromBelow ? terrain.combatModifier : 0;
    }
    modifier = Math.max(modifier, defenderModifier);
    if (attackers.some((a) => riverBetween(a.position, defender.position))) acrossRiver = true;
  }
  if (acrossRiver) modifier += RIVER_CROSSING.combatModifier;

  const modifiedDieRoll = rawDieRoll + modifier;
  const result = resolveLandCombat(attackForce, defenseForce, modifiedDieRoll);
  const ratioLabel = RATIO_COLUMNS[ratioToColumnIndex(attackForce, defenseForce)]!;

  return { attackForce, defenseForce, ratioLabel, terrainModifier: modifier, rawDieRoll, modifiedDieRoll, result };
}

/**
 * Land combat: sums attack/defense across every attacker/defender, applies
 * a terrain modifier to the attacker's die roll, and looks up the CRT.
 *
 * With multiple defenders (possible in 'multi-defender' combat mode, or
 * naturally never in 'single-defender' mode where `defenders` is always
 * length 1), the terrain modifier uses the worst case for the attacker
 * across all defenders' hexes, and the river-crossing bonus applies if ANY
 * attacker crosses a river to reach ANY defender — both are the natural
 * generalization of the single-defender rule, favoring the defense the way
 * the original rule's single-hex lookup did.
 */
export function resolveLandAttack(
  attackers: Unit[],
  defenders: Unit[],
  rawDieRoll: number,
): CombatResult {
  return computeLandAttackDetail(attackers, defenders, rawDieRoll).result;
}

/** Same computation as `resolveLandAttack`, but returns the full breakdown
 * (force totals, ratio, terrain modifier, die roll) for UI display. */
export function describeLandAttack(
  attackers: Unit[],
  defenders: Unit[],
  rawDieRoll: number,
): LandAttackDetail {
  return computeLandAttackDetail(attackers, defenders, rawDieRoll);
}

/**
 * Every enemy unit `attacker` could individually reach on its own (right
 * range for archers, adjacency for melee, domain rules for naval),
 * excluding anything already resolved against this combat phase ("a unit
 * may only be attacked once per combat phase").
 */
export function validTargets(state: GameState, attacker: Unit): Unit[] {
  const t = unitType(attacker);
  return state.units.filter((u) => {
    if (u.destroyed || u.owner === attacker.owner || u.defendedThisPhase) return false;
    const dist = hexDistance(attacker.position, u.position);
    if (t.domain === 'naval') return dist === 1; // ramming/boarding require adjacency
    return checkRangedEligibility(attacker, dist).canAttack;
  });
}

/**
 * Targets every unit in `group` can ALL individually reach — the
 * eligibility rule for 'single-defender' combat mode, where every attacker
 * must satisfy its own range requirement against the one shared target.
 */
export function commonValidTargets(state: GameState, group: Unit[]): Unit[] {
  if (group.length === 0) return [];
  let common = validTargets(state, group[0]!);
  for (const unit of group.slice(1)) {
    const targets = validTargets(state, unit);
    common = common.filter((u) => targets.some((t) => t.id === u.id));
  }
  return common;
}

/**
 * Targets reachable by AT LEAST ONE unit in `group` — the eligibility rule
 * for 'multi-defender' combat mode, where the combined attacking force can
 * spread across several defending units as long as each attacker can reach
 * at least one of them.
 */
export function unionValidTargets(state: GameState, group: Unit[]): Unit[] {
  const seen = new Map<string, Unit>();
  for (const unit of group) {
    for (const target of validTargets(state, unit)) seen.set(target.id, target);
  }
  return Array.from(seen.values());
}

/** Whether `candidate` may join the attacking side of a combat currently
 * targeting `defenderGroup`, per the join rule for `mode`. An empty
 * defender group (nothing targeted yet) always allows joining. */
export function attackerCanJoin(
  state: GameState,
  candidate: Unit,
  defenderGroup: Unit[],
  mode: CombatMode,
): boolean {
  if (defenderGroup.length === 0) return true;
  const targets = validTargets(state, candidate);
  if (mode === 'single-defender') {
    return defenderGroup.every((d) => targets.some((t) => t.id === d.id));
  }
  return defenderGroup.some((d) => targets.some((t) => t.id === d.id));
}

/** Whether `candidate` may join the defending side of a combat currently
 * being attacked by `attackGroup`, per the join rule for `mode`. */
export function defenderCanJoin(
  state: GameState,
  candidate: Unit,
  attackGroup: Unit[],
  mode: CombatMode,
): boolean {
  if (mode === 'single-defender') {
    return commonValidTargets(state, attackGroup).some((u) => u.id === candidate.id);
  }
  return unionValidTargets(state, attackGroup).some((u) => u.id === candidate.id);
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

export type DieRoller = () => number;
export const rollD6: DieRoller = () => 1 + Math.floor(Math.random() * 6);

export interface RetreatOutcome {
  stampeded: boolean;
  unitsHit: Unit[];
}

/**
 * A single unit retreating one hex away from `awayFrom` — or, if it's an
 * elephant, stampeding instead (see `resolveElephantStampede`). Shared by
 * both the attacking side (on an AR result) and the defending side (on a
 * DR result); the caller loops this over every unit on the retreating side.
 */
export function retreatOrStampede(
  state: GameState,
  unit: Unit,
  awayFrom: Unit,
  rollDie: DieRoller = rollD6,
): RetreatOutcome {
  if (unitType(unit).id === 'elephants') {
    const stampedeDie = rollDie();
    const result = resolveElephantStampede(unit, stampedeDie, state.units);
    for (const hit of result.unitsHit) hit.destroyed = true;
    return { stampeded: true, unitsHit: result.unitsHit };
  }
  const dq = Math.sign(unit.position.q - awayFrom.position.q);
  const dr = Math.sign(unit.position.r - awayFrom.position.r);
  const target = { q: unit.position.q + dq, r: unit.position.r + dr };
  const onMap = MAP_TERRAIN.has(mapHexKey(target.q, target.r));
  const occupied = unitAt(state, target);
  if (onMap && !occupied) unit.position = target;
  else unit.destroyed = true; // no legal retreat hex
  return { stampeded: false, unitsHit: [] };
}

export interface LandCombatOutcome {
  result: CombatResult;
  /** True on an 'EX' result with more than one attacking unit: the caller
   * must still ask the attacking player which of THEIR units to sacrifice
   * (see `exchangeSacrificeMeetsThreshold` / `applyExchangeSacrifice`)
   * before the combat is fully resolved. */
  requiresExchangeChoice: boolean;
  /** The defenders' total force — the threshold a chosen sacrifice must
   * meet or exceed. Meaningful whenever `result === 'EX'`. */
  requiredSacrificeForce: number;
  retreats: RetreatOutcome[];
}

/**
 * Applies a resolved land-combat result to the units involved. Marks every
 * defender `defendedThisPhase` regardless of outcome (enforcing "a unit may
 * only be attacked once per combat phase").
 *
 * On 'EX' (Échange), per the rulebook ("les unités attaquées sont retirées
 * du jeu, ainsi que les unités attaquantes totalisant une force au moins
 * égale"): defenders are always destroyed, and the attacker must ALSO lose
 * enough of their own units to total at least the defenders' force. With
 * only one attacking unit there's no real choice, so it's destroyed here
 * directly; with more than one, this function stops short and reports
 * `requiresExchangeChoice: true` so the caller can let the attacking player
 * pick which units to sacrifice.
 */
export function applyLandCombatResult(
  state: GameState,
  attackers: Unit[],
  defenders: Unit[],
  result: CombatResult,
  rollDie: DieRoller = rollD6,
): LandCombatOutcome {
  for (const d of defenders) d.defendedThisPhase = true;
  const requiredSacrificeForce = defenders.reduce((sum, u) => sum + currentDefense(u), 0);
  const retreats: RetreatOutcome[] = [];

  switch (result) {
    case 'AE':
      for (const a of attackers) a.destroyed = true;
      break;
    case 'DE':
      for (const d of defenders) d.destroyed = true;
      break;
    case 'AR':
      for (const a of attackers) retreats.push(retreatOrStampede(state, a, defenders[0]!, rollDie));
      break;
    case 'DR':
      for (const d of defenders) retreats.push(retreatOrStampede(state, d, attackers[0]!, rollDie));
      break;
    case 'EX':
      for (const d of defenders) d.destroyed = true;
      if (attackers.length <= 1) {
        for (const a of attackers) a.destroyed = true;
        return { result, requiresExchangeChoice: false, requiredSacrificeForce, retreats };
      }
      return { result, requiresExchangeChoice: true, requiredSacrificeForce, retreats };
  }
  return { result, requiresExchangeChoice: false, requiredSacrificeForce, retreats };
}

/** Whether `selected` attacking units' combined attack value meets the
 * exchange-sacrifice threshold required on an 'EX' result. */
export function exchangeSacrificeMeetsThreshold(selected: Unit[], requiredForce: number): boolean {
  return selected.reduce((sum, u) => sum + currentAttack(u), 0) >= requiredForce;
}

export function applyExchangeSacrifice(selected: Unit[]): void {
  for (const u of selected) u.destroyed = true;
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
