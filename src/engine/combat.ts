import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, RIVER_HEXSIDES, riverEdgeKey, hexKey as mapHexKey } from '../data/map';
import { TERRAIN_EFFECTS, RIVER_CROSSING, isSeaLike, type TerrainType } from '../data/terrain';
import { resolveLandCombat, ratioToColumnIndex, RATIO_COLUMNS, type CombatResult } from '../data/combatTable';
import { isRammingSuccessful, type ShipTypeId } from '../data/navalRamming';
import { resolveBoarding, type BoardingResult } from '../data/navalBoarding';
import { hexAdd, hexDistance, hexEquals, areFacingsParallel, DIRECTIONS } from './hex';
import {
  type GameState,
  type Unit,
  type CombatMode,
  unitType,
  unitCategory,
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
 * Phalanxes' long lances (5-7m) make them unapproachable by horse: "la
 * cavalerie ne peut effectuer de charge ou plus simplement d'attaques contre
 * ces unités" (`docs/research/05-rules-french-original.md`) — cavalry may
 * never attack a phalanx, whether by charge or by an ordinary attack. This
 * is the ONLY unit-vs-unit targeting restriction beyond range/adjacency, so
 * it's kept as its own small predicate rather than folded into
 * `checkRangedEligibility` (which only knows the attacker and a distance,
 * not the defender's type).
 */
export function cavalryMayAttack(attacker: Unit, defender: Unit): boolean {
  if (unitCategory(attacker.typeId) !== 'cavalry') return true;
  return unitType(defender).id !== 'phalanges';
}

/**
 * Every enemy unit `attacker` could individually reach on its own (right
 * range for archers, adjacency for melee, domain rules for naval),
 * excluding anything already resolved against this combat phase ("a unit
 * may only be attacked once per combat phase") and, for cavalry, phalanx
 * targets (see `cavalryMayAttack`).
 */
export function validTargets(state: GameState, attacker: Unit): Unit[] {
  const t = unitType(attacker);
  return state.units.filter((u) => {
    if (u.destroyed || u.owner === attacker.owner || u.defendedThisPhase) return false;
    if (!cavalryMayAttack(attacker, u)) return false;
    const dist = hexDistance(attacker.position, u.position);
    // Ramming is a movement-phase event (see `navalMovement.findRammingContacts`) —
    // by the time the Combat phase runs, the only naval option left is boarding.
    if (t.domain === 'naval') return dist === 1 && canBoard(attacker, u);
    return checkRangedEligibility(attacker, dist).canAttack;
  });
}

/**
 * Whether two adjacent ships may fight by boarding: "l'abordage nécessite
 * que les vaisseaux se présentent parallèlement sur des hexagones
 * contigus" — the ships' facings must run along the same line of travel
 * (identical or exactly opposite), as opposed to one ship's bow pointing
 * directly at the other, which is a ramming angle instead.
 */
export function canBoard(attacker: Unit, defender: Unit): boolean {
  return hexDistance(attacker.position, defender.position) === 1 && areFacingsParallel(attacker.facing, defender.facing);
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
 * Whether a drifting elephant may enter `hex` at all: on the map, and
 * within the "land zone" (not sea-like, not coastal fringe). Per the
 * rulebook ("lorsqu'il sort du plateau de jeu ou de la zone terrestre, il
 * est éliminé"), failing this eliminates the elephant on the spot.
 */
export function canElephantEnterHex(hex: HexCoord): boolean {
  const terrain = MAP_TERRAIN.get(mapHexKey(hex.q, hex.r));
  if (terrain === undefined) return false; // off the map
  return terrain !== 'coast' && !isSeaLike(terrain);
}

/**
 * The 6 hexes adjacent to `unit` that it may legally retreat into: on the
 * map, unoccupied (by either side — no stacking), and not under an enemy
 * zone of control ("a retreating unit may never be forced to retreat into
 * an enemy ZOC hex"). The owning player picks among these.
 */
export function legalRetreatHexes(state: GameState, unit: Unit): HexCoord[] {
  const enemyZoc = hexesUnderZoc(state, unit.owner);
  return DIRECTIONS.map((d) => hexAdd(unit.position, d)).filter((hex) => {
    if (!MAP_TERRAIN.has(mapHexKey(hex.q, hex.r))) return false; // off the map
    if (unitAt(state, hex)) return false; // occupied, friend or foe
    if (enemyZoc.has(mapHexKey(hex.q, hex.r))) return false;
    return true;
  });
}

/**
 * Friendly units occupying EVERY one of `unit`'s 6 neighboring hexes — the
 * rulebook's exception to elimination-on-no-retreat: "a unit forced to
 * retreat with nowhere legal to go is simply eliminated — unless it's
 * surrounded entirely by friendly units, in which case it pushes one
 * friendly unit aside and takes its hex instead." Returns `[]` (no push
 * option, ordinary elimination applies) if even one neighbor is off-map or
 * occupied by an enemy — the exception only covers being boxed in by one's
 * own side.
 *
 * Only neighbors that themselves have somewhere legal to retreat to are
 * offered: "pushed aside" means that unit actually retreats to make room
 * (see `completePush`), not swapping places — a neighbor with no room of
 * its own can't make room for anyone else either.
 */
export function pushCandidates(state: GameState, unit: Unit): Unit[] {
  const neighbors = DIRECTIONS.map((d) => hexAdd(unit.position, d));
  const friendlyOccupants: Unit[] = [];
  for (const hex of neighbors) {
    if (!MAP_TERRAIN.has(mapHexKey(hex.q, hex.r))) return [];
    const occupant = unitAt(state, hex);
    if (!occupant || occupant.owner !== unit.owner) return [];
    friendlyOccupants.push(occupant);
  }
  return friendlyOccupants.filter((f) => legalRetreatHexes(state, f).length > 0);
}

/** Moves a retreating unit to a player-chosen hex from `legalRetreatHexes`. */
export function retreatUnitTo(unit: Unit, hex: HexCoord): void {
  unit.position = hex;
}

/**
 * Resolves the "surrounded by friendly units" exception (see
 * `pushCandidates`): `pushed` actually retreats to `pushedDestination` (a
 * hex the player chose from ITS OWN `legalRetreatHexes`) to make room, and
 * `unit` then takes the hex `pushed` just vacated.
 */
export function completePush(unit: Unit, pushed: Unit, pushedDestination: HexCoord): void {
  const vacated = pushed.position;
  pushed.position = pushedDestination;
  unit.position = vacated;
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
  /** Elephants forced to retreat (AR/DR) never resolve here — the caller
   * must drive their "drift" step by step (roll a direction, walk it hex
   * by hex, resolve real combat against anything encountered), since a
   * unit it tramples into can itself need a player choice (or its own
   * drift) before the elephant can continue. See `canElephantEnterHex`. */
  pendingDrifts: Unit[];
  /** Non-elephant units forced to retreat (AR/DR) that still need the
   * owning player to pick a destination — see `legalRetreatHexes` /
   * `pushCandidates` and `retreatUnitTo` / `completePush`. Process these
   * one at a time: each choice can change what's legal for the next unit
   * in the list. A unit with no legal hex and no push option is eliminated
   * immediately here and does NOT appear in this list. */
  pendingRetreats: Unit[];
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
): LandCombatOutcome {
  for (const d of defenders) d.defendedThisPhase = true;
  const requiredSacrificeForce = defenders.reduce((sum, u) => sum + currentDefense(u), 0);
  const pendingDrifts: Unit[] = [];
  const pendingRetreats: Unit[] = [];

  const forceRetreat = (unit: Unit) => {
    if (unitType(unit).id === 'elephants') {
      pendingDrifts.push(unit);
      return;
    }
    if (legalRetreatHexes(state, unit).length > 0 || pushCandidates(state, unit).length > 0) {
      pendingRetreats.push(unit);
      return;
    }
    unit.destroyed = true; // no legal retreat hex, and not surrounded by friendlies either
  };

  switch (result) {
    case 'AE':
      for (const a of attackers) a.destroyed = true;
      break;
    case 'DE':
      for (const d of defenders) d.destroyed = true;
      break;
    case 'AR':
      for (const a of attackers) forceRetreat(a);
      break;
    case 'DR':
      for (const d of defenders) forceRetreat(d);
      break;
    case 'EX':
      for (const d of defenders) d.destroyed = true;
      if (attackers.length <= 1) {
        for (const a of attackers) a.destroyed = true;
        return { result, requiresExchangeChoice: false, requiredSacrificeForce, pendingDrifts, pendingRetreats };
      }
      return { result, requiresExchangeChoice: true, requiredSacrificeForce, pendingDrifts, pendingRetreats };
  }
  return { result, requiresExchangeChoice: false, requiredSacrificeForce, pendingDrifts, pendingRetreats };
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

/** A successful ram sinks the target ship outright ("la galère de
 * l'attaquant coule la quintirème"); a miss leaves both ships intact. */
export function applyRammingResult(defender: Unit, hit: boolean): void {
  defender.defendedThisPhase = true;
  if (hit) defender.destroyed = true;
}

/**
 * Applies a resolved boarding result: the losing side (if any — a blank/pink
 * cell means the engagement wasn't decisive) loses `equipmentLoss` equipment
 * points, each worth -5 attack/-5 defense; a ship whose equipment reaches
 * zero has nothing left to fight with and is removed from the game.
 */
export function applyBoardingResult(attacker: Unit, defender: Unit, result: BoardingResult): void {
  defender.defendedThisPhase = true;
  if (result.side === null || result.equipmentLoss <= 0) return;
  const victim = result.side === 'attacker' ? attacker : defender;
  victim.equipmentPoints = Math.max(0, (victim.equipmentPoints ?? 0) - result.equipmentLoss);
  if (victim.equipmentPoints <= 0) victim.destroyed = true;
}
