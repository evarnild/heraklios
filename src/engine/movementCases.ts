import { getUnitType } from '../data/units';
import { applyAction } from './actions';
import {
  buildElephantScenarioGameState,
  buildFuzzGameState,
  buildPushScenarioGameState,
} from './fuzzHarness';
import { reachableHexes, reachableNavalStates } from './movement';
import { createSeededRng } from './rng';
import { hexKey } from './hex';
import { unitCategory, type GameState, type Unit } from './state';

/**
 * Positions for the movement-search tests (§66): the fuzz harness's three
 * purpose-built armies, each walked a few steps by a seeded random mover, so
 * land and ship units stand on varied terrain, beside rivers and beside
 * enemies. Deterministic: a case is a pure function of its name.
 */
export interface MovementCase {
  name: string;
  state: GameState;
}

const BUILDERS: Array<[string, () => GameState]> = [
  ['fuzz', buildFuzzGameState],
  ['push', buildPushScenarioGameState],
  ['elephant', buildElephantScenarioGameState],
];

/** Every living unit gets its full allowance, as at the start of a Movement phase. */
export function refillMovement(state: GameState): void {
  for (const unit of state.units) {
    if (!unit.destroyed) unit.movementLeft = getUnitType(unit.typeId).movement;
  }
}

function walkOneStep(state: GameState, rng: () => number): void {
  const living = state.units.filter((u) => !u.destroyed);
  const unit = living[Math.floor(rng() * living.length)]!;
  unit.movementLeft = getUnitType(unit.typeId).movement;
  if (unitCategory(unit.typeId) === 'naval') {
    const targets = [...reachableNavalStatesKeys(state, unit)];
    if (targets.length === 0) return;
    const to = targets[Math.floor(rng() * targets.length)]!;
    applyAction(state, { kind: 'navalMove', unitId: unit.id, to });
    return;
  }
  const keys = [...reachableHexes(state, unit).keys()];
  if (keys.length === 0) return;
  const [q, r] = keys[Math.floor(rng() * keys.length)]!.split(',').map(Number);
  applyAction(state, { kind: 'landMove', unitId: unit.id, to: { q: q!, r: r! } });
}

function reachableNavalStatesKeys(state: GameState, unit: Unit): Array<{ q: number; r: number }> {
  const seen = new Map<string, { q: number; r: number }>();
  for (const s of reachableNavalStates(state, unit).values()) {
    if (hexKey(s.hex) !== hexKey(unit.position)) seen.set(hexKey(s.hex), s.hex);
  }
  return [...seen.values()];
}

export function movementCases(): MovementCase[] {
  const cases: MovementCase[] = [];
  for (const [name, build] of BUILDERS) {
    for (let seed = 1; seed <= 6; seed++) {
      const state = build();
      const rng = createSeededRng(seed * 7919);
      for (let step = 0; step < seed * 6; step++) walkOneStep(state, rng);
      refillMovement(state);
      cases.push({ name: `${name}-${seed}`, state });
    }
  }
  return cases;
}

/** One unit's searches as a stable string: sorted entries of both maps. */
export function searchFingerprint(state: GameState, unit: Unit): string {
  if (unitCategory(unit.typeId) === 'naval') {
    const states = [...reachableNavalStates(state, unit).entries()]
      .map(([key, s]) => `${key}=${s.cost}`)
      .sort();
    return states.join(';');
  }
  return [...reachableHexes(state, unit).entries()]
    .map(([key, cost]) => `${key}=${cost}`)
    .sort()
    .join(';');
}

/** FNV-1a, enough to detect any change to a search's returned map. */
export function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

export function searchSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of movementCases()) {
    for (const unit of c.state.units) {
      if (unit.destroyed) continue;
      const fp = searchFingerprint(c.state, unit);
      out[`${c.name}/${unit.id}`] = `${fp.split(';').length}:${fnv(fp)}`;
    }
  }
  return out;
}
