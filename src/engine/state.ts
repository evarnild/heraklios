import type { HexCoord } from '../data/map';
import { getUnitType, type UnitType } from '../data/units';

export type PlayerId = 0 | 1 | 2 | 3;
export type Phase = 'movement' | 'combat';

/**
 * Which land-combat variant is in effect for this game:
 * - 'single-defender': the literal rulebook rule — several attackers may
 *   combine, but always against exactly one enemy unit.
 * - 'multi-defender': a house-rule variant (the rulebook doesn't cover
 *   this case) where both sides can be groups — several attackers and
 *   several defenders combined into one battle.
 */
export type CombatMode = 'single-defender' | 'multi-defender';

export interface Unit {
  id: string;
  owner: PlayerId;
  typeId: string;
  position: HexCoord;
  /** Movement points remaining in the current Movement phase. */
  movementLeft: number;
  /** Naval facing as a direction index 0-5 (see engine/hex.ts DIRECTIONS). Land units ignore this. */
  facing: number;
  /** Naval-only: equipment points remaining (each lost point = -5 atk/-5 def). Undefined for land units. */
  equipmentPoints?: number;
  /** True once this unit has been the target of a combat resolution this phase — "a unit may only be attacked once per combat phase," regardless of the result. Reset at the start of each combat phase. */
  defendedThisPhase: boolean;
  /**
   * Cavalry only: true when this unit's most recent move satisfied the
   * charge condition (see `engine/movement.ts`'s `evaluateCharge` for the
   * exact eligibility check) — spent its ENTIRE movement allowance moving
   * in one straight line and ended adjacent to an enemy unit. Doubles
   * `currentAttack` for the rest of the owning player's turn (through their
   * following Combat phase), then is cleared at the start of their next
   * Movement phase (`BoardScene.resetMovementForActivePlayer`, mirroring how
   * `movementLeft` itself is refreshed there). Always false for non-cavalry.
   */
  charged: boolean;
  destroyed: boolean;
}

export function unitType(unit: Unit): UnitType {
  return getUnitType(unit.typeId);
}

/**
 * The `canEnterTerrain` category a unit type falls into. Lives here (rather
 * than in `engine/movement.ts`, its original home) so both `movement.ts` and
 * `combat.ts` can use it without creating a `combat.ts` <-> `movement.ts`
 * import cycle (`movement.ts` already imports several helpers from
 * `combat.ts`) — `state.ts` sits below both. `movement.ts` re-exports it
 * unchanged for existing callers (`PlacementScene`, its own tests).
 */
export function unitCategory(typeId: string): 'chariot' | 'cavalry' | 'elephant' | 'land' | 'naval' {
  const t = getUnitType(typeId);
  if (t.domain === 'naval') return 'naval';
  if (t.id.startsWith('chars-')) return 'chariot';
  if (t.id.startsWith('cavalerie-')) return 'cavalry';
  if (t.id === 'elephants') return 'elephant';
  return 'land';
}

/**
 * Naval-only: a ship TYPE's equipment points when fully equipped — one
 * point per 5 points of printed defense, rounding up. Every unit-creation
 * site (`PlacementScene`, `testMode.ts`, `fuzzHarness.ts`, and the
 * save/history test fixtures) seeds a fresh ship's `equipmentPoints` with
 * this exact formula, applied to the `UnitType` it's building from (before
 * a `Unit` even exists yet) — this overload, and `maxEquipmentPoints`
 * below for an already-built `Unit`, are both routed through it so there's
 * one literal place the `/ 5` formula is written. Returns 0 for non-naval
 * types, matching `maxEquipmentPoints`'s land-unit behavior below.
 */
export function maxEquipmentPointsForType(t: UnitType): number {
  if (t.domain !== 'naval') return 0;
  return Math.ceil(t.defense / 5);
}

/**
 * Naval-only: the ship's equipment points when fully equipped (see
 * `maxEquipmentPointsForType` above) — exposed for combat-log formatting
 * (see `BoardScene`'s boarding prompt) to show "N/max equipment" from a
 * live `Unit` without re-deriving the formula. Returns 0 for land units,
 * whose `equipmentPoints` is always `undefined` ("not applicable" rather
 * than "zero").
 */
export function maxEquipmentPoints(unit: Unit): number {
  return maxEquipmentPointsForType(unitType(unit));
}

export function currentAttack(unit: Unit): number {
  const t = unitType(unit);
  if (t.domain === 'naval' && unit.equipmentPoints !== undefined) {
    const lost = Math.max(0, maxEquipmentPoints(unit) - unit.equipmentPoints);
    return Math.max(0, t.attack - lost * 5);
  }
  // Charging cavalry doubles its printed attack value (light 3->6, heavy
  // 6->12, matching the rulebook's worked example). `unit.charged` is only
  // ever set for cavalry (see `evaluateCharge`), but the category check here
  // is cheap insurance against that flag ever being set on the wrong type.
  if (unit.charged && unitCategory(unit.typeId) === 'cavalry') return t.attack * 2;
  return t.attack;
}

/**
 * The force this unit brings when it attacks *by projectile* — the
 * parenthesized number on the counter (`attack (rangedAttack) range /
 * defense movement`), which the rulebook names outright: "le chiffre entre
 * parenthèses correspond à la valeur d'attaque par projectiles (flèches des
 * archers, par exemple). Toutes les unités qui ont une valeur nulle en force
 * d'attaque par projectiles sont obligées de combattre au contact"
 * (`docs/research/05-rules-french-original.md:78-82`).
 *
 * Which of this and `currentAttack` a given attacker actually contributes to
 * a combat is decided per-attacker by `combat.ts`'s `attackForceAgainst`,
 * from its distance to the units it is engaging.
 *
 * No charge doubling: a charge requires ending *adjacent* to an enemy and
 * only cavalry can make one, and no cavalry type has a ranged attack — so
 * the two are mutually exclusive by construction, not by a check here.
 *
 * Ship equipment loss IS applied, mirroring `currentAttack`/`currentDefense`,
 * even though it zeroes a trirème's ranged 2 on its first lost point: naval
 * units never make a ranged attack in this implementation (`validTargets`
 * reduces every naval attack to an adjacent boarding), so the branch is
 * unreachable and consistency with its two siblings is worth more than an
 * invented softer rule.
 */
export function currentRangedAttack(unit: Unit): number {
  const t = unitType(unit);
  if (t.domain === 'naval' && unit.equipmentPoints !== undefined) {
    const lost = Math.max(0, maxEquipmentPoints(unit) - unit.equipmentPoints);
    return Math.max(0, t.rangedAttack - lost * 5);
  }
  return t.rangedAttack;
}

export function currentDefense(unit: Unit): number {
  const t = unitType(unit);
  if (t.domain === 'naval' && unit.equipmentPoints !== undefined) {
    const lost = Math.max(0, maxEquipmentPoints(unit) - unit.equipmentPoints);
    return Math.max(0, t.defense - lost * 5);
  }
  return t.defense;
}

export interface Player {
  id: PlayerId;
  name: string;
  edge: 'N' | 'S' | 'E' | 'W';
  purchasePoints: number;
  eliminated: boolean;
}

export interface GameState {
  players: Player[];
  units: Unit[];
  turnNumber: number;
  activePlayerIndex: number; // index into seatOrder
  seatOrder: PlayerId[];
  phase: Phase;
  combatMode: CombatMode;
  /**
   * House rule (the rulebook is silent on this): when true, `seatOrder` is
   * reshuffled at the start of each new full turn instead of staying in the
   * fixed order drawn at the initial edge-assignment dice-off. Chosen once on
   * the Menu screen; defaults to false so existing games keep playing exactly
   * as they always have unless a player opts in. See `advancePhase` in
   * `turnManager.ts` for where and why the reshuffle happens.
   */
  randomizedTurnOrder: boolean;
  gameOver: boolean;
  winnerId: PlayerId | null;
}

export function livingUnits(state: GameState, owner?: PlayerId): Unit[] {
  return state.units.filter((u) => !u.destroyed && (owner === undefined || u.owner === owner));
}

export function armyValue(state: GameState, owner: PlayerId): number {
  return livingUnits(state, owner).reduce((sum, u) => sum + unitType(u).cost, 0);
}

export function currentPlayer(state: GameState): Player {
  const id = state.seatOrder[state.activePlayerIndex]!;
  return state.players.find((p) => p.id === id)!;
}
