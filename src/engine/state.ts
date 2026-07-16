import type { HexCoord } from '../data/map';
import { getUnitType, type UnitType } from '../data/units';

export type PlayerId = 0 | 1 | 2 | 3;
export type Phase = 'movement' | 'combat';

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
  /** True once this unit has been forced to retreat this combat phase (used to allow only one attack per phase against it, and to gate elephant stampede). */
  hasRetreatedThisPhase: boolean;
  destroyed: boolean;
}

export function unitType(unit: Unit): UnitType {
  return getUnitType(unit.typeId);
}

export function currentAttack(unit: Unit): number {
  const t = unitType(unit);
  if (t.domain === 'naval' && unit.equipmentPoints !== undefined) {
    const fullEquipment = Math.ceil(t.defense / 5);
    const lost = Math.max(0, fullEquipment - unit.equipmentPoints);
    return Math.max(0, t.attack - lost * 5);
  }
  return t.attack;
}

export function currentDefense(unit: Unit): number {
  const t = unitType(unit);
  if (t.domain === 'naval' && unit.equipmentPoints !== undefined) {
    const fullEquipment = Math.ceil(t.defense / 5);
    const lost = Math.max(0, fullEquipment - unit.equipmentPoints);
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
