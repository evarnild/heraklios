import type { Phase } from '../../engine/state';
import type { SeatControl } from '../../engine/seatControl';
import { messages } from './index';

/** A unit type's name in the current language. An id the table doesn't know
 * (it can't happen for `UNIT_TYPES`; a test pins that) shows as itself. */
export function unitName(typeId: string): string {
  return (messages().units as Record<string, string>)[typeId] ?? typeId;
}

/** The four default player names, seat by seat, in the current language. */
export function countryNames(): string[] {
  return [...messages().countries];
}

/** A terrain type's label (the four named zones included) in the current language. */
export function terrainName(terrain: string): string {
  return (messages().terrain as Record<string, string>)[terrain] ?? terrain;
}

export function edgeName(edge: string): string {
  return (messages().edges as Record<string, string>)[edge] ?? edge;
}

/** The counter colour's display word for a seat. */
export function colorName(playerIndex: number): string {
  return messages().colors[playerIndex] ?? '?';
}

export function phaseName(phase: Phase): string {
  return messages().phases[phase];
}

export function seatControlName(control: SeatControl): string {
  return messages().seat[control];
}
