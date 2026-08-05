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
 * Naval-only: the ship's equipment points when fully equipped — one point
 * per 5 points of printed defense, rounding up. This is the same formula
 * every unit-creation site (`PlacementScene`, `testMode.ts`,
 * `fuzzHarness.ts`, and the save/history test fixtures) uses to seed a
 * fresh ship's `equipmentPoints`, pulled out here as the single shared
 * source of truth so combat-log formatting (see `BoardScene`'s boarding
 * prompt) can show "N/max equipment" without re-deriving the formula.
 * Returns 0 for land units, whose `equipmentPoints` is always `undefined`
 * ("not applicable" rather than "zero").
 */
export function maxEquipmentPoints(unit: Unit): number {
  const t = unitType(unit);
  if (t.domain !== 'naval') return 0;
  return Math.ceil(t.defense / 5);
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
