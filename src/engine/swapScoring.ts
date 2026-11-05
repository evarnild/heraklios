import { hexKey as mapHexKey } from '../data/map';
import { applyAction, type Action } from './actions';
import type { GameState, Unit } from './state';

/**
 * §59: how a planning-tier computer seat values a unit swap (`landSwap`).
 *
 * A swap leaves the pair's two hexes occupied, so approach and terrain are not
 * its terms. It is worth two things, both measured as DIFFERENCES between the
 * swapped and the unswapped placement of the same board:
 *
 * - CONTACT: how much better the pair's best attacks get ("bring the stronger
 *   attacker into contact");
 * - SHELTER: how much less exposed the pair gets to the strongest enemy reply
 *   ("pull the exposed unit out of reach and put a sturdier one there").
 *
 * Because both are differences of the same per-placement measure, swapping a
 * pair back scores EXACTLY the negation of the swap just made (spec B8), so
 * the agent never swaps straight back. That only holds if both placements are
 * priced under the same conditions, which is why every board priced here is a
 * probe clone with `charged` and `defendedThisPhase` cleared on every unit.
 *
 * Pure functions: the pricing itself (`attackFrom`, `exposure`) is handed in
 * by `HeuristicAgent`, which owns the opponent model and the tier's combat
 * scoring. This file owns the arithmetic and the cost bound.
 */

export type LandSwapAction = Extract<Action, { kind: 'landSwap' }>;

/** A swap candidate scored for `chooseMovementAction` (same shape as its
 * `Scored`). */
export interface ScoredSwap {
  action: LandSwapAction;
  score: number;
  /** Index in the `legal` array, the stable tie-break. */
  order: number;
}

/** How many swap candidates may get exposure probes on one action choice. A
 * probe is a full enemy `legalActions` on a clone, the expensive part, so the
 * best swaps by contact score are probed first (front-line pairs only, see
 * `isFrontLinePair`).
 *
 * Like `LOOKAHEAD_CANDIDATE_LIMIT`, only pinned downward: setting it to 0
 * fails the test that needs a shelter-only swap; nothing asserts 4 over
 * another positive value, and raising it is an accuracy/performance tradeoff
 * no test could object to. */
export const SWAP_PROBE_LIMIT = 4;

/** A structuredClone with `defendedThisPhase` and `charged` cleared on every
 * unit: the conditions every board in this file is priced under (a swap is
 * never a charge, and the unswapped side must be priced the same way). */
export function probeClone(state: GameState): GameState {
  const clone = structuredClone(state) as GameState;
  for (const u of clone.units) {
    u.defendedThisPhase = false;
    u.charged = false;
  }
  return clone;
}

/** A probe clone of `state` with `action` applied (both units end up in each
 * other's hex, `charged` false on both). `state` itself is not touched. */
export function swappedClone(state: GameState, action: LandSwapAction): GameState {
  const clone = probeClone(state);
  applyAction(clone, action);
  return clone;
}

function unitIn(board: GameState, id: string): Unit {
  const unit = board.units.find((u) => u.id === id);
  if (!unit) throw new Error(`swapScoring: no unit "${id}" on the board`);
  return unit;
}

/**
 * The gain in the pair's best attack value: for each of the two units,
 * `attackFrom(after, unit)` minus `attackFrom(before, unit)`, summed. `before`
 * and `after` are boards that differ only by the swap; `attackFrom` prices a
 * unit where it stands on the board it is given.
 */
export function contactGain(
  before: GameState,
  after: GameState,
  ids: readonly [string, string],
  attackFrom: (board: GameState, unit: Unit) => number,
): number {
  let gain = 0;
  for (const id of ids) gain += attackFrom(after, unitIn(after, id)) - attackFrom(before, unitIn(before, id));
  return gain;
}

/** Whether either hex of the pair is under enemy zone of control (`zoc`, a
 * set of map hex keys). The two units exchange hexes, so the pair's hexes are
 * the same set before and after the swap. */
export function isFrontLinePair(before: GameState, ids: readonly [string, string], zoc: ReadonlySet<string>): boolean {
  return ids.some((id) => {
    const { position } = unitIn(before, id);
    return zoc.has(mapHexKey(position.q, position.r));
  });
}

/**
 * The fall in the pair's exposure: for each unit, `exposure(before, id)` minus
 * `exposure(after, id)`, summed. 0, without calling `exposure` at all, when
 * neither hex of the pair is under enemy zone of control (exposure is only
 * taken for a unit on, or swapping onto, a hex in enemy ZOC; archers can
 * still shoot a unit outside every ZOC at range 2, which this term ignores to
 * keep the cost bounded).
 *
 * Interpretation (spec, Interpretations): a land unit has no damage state, so
 * "pull the weakened unit out" is read as "pull the more exposed unit out",
 * where exposure is the strongest immediate enemy attack against it.
 */
export function shelterGain(
  before: GameState,
  after: GameState,
  ids: readonly [string, string],
  exposure: (board: GameState, unitId: string) => number,
  zoc: ReadonlySet<string>,
): number {
  if (!isFrontLinePair(before, ids, zoc)) return 0;
  let gain = 0;
  for (const id of ids) gain += exposure(before, id) - exposure(after, id);
  return gain;
}

export interface SwapScoringInput {
  /** The board the choice is made on (not touched). */
  state: GameState;
  /** The action list `legalActions` offered; its `landSwap` entries are scored. */
  legal: readonly Action[];
  /** Hexes under enemy zone of control for the active owner. */
  zoc: ReadonlySet<string>;
  /** Price shelter too (Expected value and Cautious); Greedy is blind to its own risk. */
  withShelter: boolean;
  weights: { swapContact: number; swapShelter: number };
  /** Best attack value of `unit` where it stands on `board` (charged = false). */
  attackFrom: (board: GameState, unit: Unit) => number;
  /** Strongest immediate enemy reply against `unitId` on `board`. */
  exposure: (board: GameState, unitId: string) => number;
}

/**
 * Scores every offered swap: contact for all of them, shelter added for the
 * best `SWAP_PROBE_LIMIT` front-line pairs by contact (ties by `legal` order).
 */
export function scoreSwaps(input: SwapScoringInput): ScoredSwap[] {
  const { state, legal, zoc, weights } = input;
  const offered = legal.flatMap((action, order) => (action.kind === 'landSwap' ? [{ action, order }] : []));
  if (offered.length === 0) return [];

  // The unswapped side is priced once per unit, not once per pair it is in.
  const before = probeClone(state);
  const attackBefore = new Map<string, number>();
  const attackFrom = (board: GameState, unit: Unit): number => {
    if (board !== before) return input.attackFrom(board, unit);
    let value = attackBefore.get(unit.id);
    if (value === undefined) {
      value = input.attackFrom(board, unit);
      attackBefore.set(unit.id, value);
    }
    return value;
  };
  const exposureBefore = new Map<string, number>();
  const exposure = (board: GameState, id: string): number => {
    if (board !== before) return input.exposure(board, id);
    let value = exposureBefore.get(id);
    if (value === undefined) {
      value = input.exposure(board, id);
      exposureBefore.set(id, value);
    }
    return value;
  };

  const rows = offered.map(({ action, order }) => {
    const ids = [action.unitId, action.otherId] as const;
    const after = swappedClone(state, action);
    const contact = contactGain(before, after, ids, attackFrom);
    return { action, order, ids, after, contact, shelter: 0 };
  });

  if (input.withShelter) {
    rows
      .filter((row) => isFrontLinePair(before, row.ids, zoc))
      .sort((a, b) => b.contact - a.contact || a.order - b.order)
      .slice(0, SWAP_PROBE_LIMIT)
      .forEach((row) => {
        row.shelter = shelterGain(before, row.after, row.ids, exposure, zoc);
      });
  }

  return rows.map((row) => ({
    action: row.action,
    order: row.order,
    score: weights.swapContact * row.contact + weights.swapShelter * row.shelter,
  }));
}
