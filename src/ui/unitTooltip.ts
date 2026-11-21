import type { HexCoord } from '../data/map';
import { unitAt } from '../engine/combat';
import {
  currentAttack, currentDefense, currentRangedAttack, maxEquipmentPoints,
  unitCategory, unitType, type GameState, type Unit,
} from '../engine/state';
import { messages } from './i18n';
import { colorName, unitName } from './i18n/names';

export interface UnitTooltipOptions {
  /** Show the state line (movement left, equipment, charged). Off in Placement (B6). */
  state: boolean;
}

/**
 * I1 (spec §74): "characteristics" means the values IN PLAY (a charge doubles
 * attack, lost ship equipment takes 5 per point), with the printed value in
 * brackets where it differs, so the tooltip never contradicts what combat uses.
 */
function value(label: string, current: number, printed: number): string {
  return current === printed ? `${label} ${current}` : `${label} ${current} (${printed})`;
}

/** The unit lines of the hex tooltip (spec §74 B2-B7), joined by `\n`. */
export function formatUnitTooltip(
  unit: Unit,
  owner: { name: string; index: number },
  opts: UnitTooltipOptions,
): string {
  const t = messages().tooltip;
  const type = unitType(unit);
  const values = [value(t.attack, currentAttack(unit), type.attack)];
  if (type.range > 0) {
    values.push(value(t.ranged, currentRangedAttack(unit), type.rangedAttack), `${t.range} ${type.range}`);
  }
  values.push(value(t.defense, currentDefense(unit), type.defense), `${t.movement} ${type.movement}`);
  const lines = [t.owner(unitName(unit.typeId), owner.name, colorName(owner.index)), values.join(', ')];
  if (opts.state) {
    const state = [`${t.movementLeft} ${unit.movementLeft}`];
    if (unitCategory(unit.typeId) === 'naval' && unit.equipmentPoints !== undefined) {
      state.push(`${t.equipment} ${unit.equipmentPoints}/${maxEquipmentPoints(unit)}`);
    }
    if (unit.charged) state.push(t.charged);
    lines.push(state.join(', '));
  }
  return lines.join('\n');
}

/** The lines for the living unit on `hex`, or null (B5). */
export function unitTooltipFor(state: GameState, hex: HexCoord, opts: UnitTooltipOptions): string | null {
  const unit = unitAt(state, hex);
  if (!unit) return null;
  const player = state.players[unit.owner];
  return formatUnitTooltip(unit, { name: player?.name ?? '?', index: unit.owner }, opts);
}
