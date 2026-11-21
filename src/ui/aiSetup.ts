import { defaultArmySelection } from '../engine/army';
import { autoDeploy } from '../engine/deployment';
import { isAiSeat } from '../engine/seatControl';
import type { GameState } from '../engine/state';
import { seatControlFor, session } from './session';

/**
 * Setup for the seats a human never touches (plan.md §6.4's Stage 4).
 *
 * `ArmyBuilderScene` and `PlacementScene` are both per-seat scenes reached by
 * `scene.start(..., { playerIndex })`, so "skip the AI seats" is a question
 * about which index to start NEXT, not something either scene can answer from
 * inside itself. Both helpers below therefore do the AI seats' work and hand
 * back the next seat that actually needs a human — deliberately resolved at
 * the transition rather than by having a scene restart itself from its own
 * `create()`.
 */

/**
 * Fills in every AI seat's army from `fromIndex` onward with the same
 * ready-made 400-point selection the Army Builder's own "default army" button
 * offers, and returns the first seat from `fromIndex` on that still needs a
 * human — or `null` when every remaining seat is an AI.
 *
 * The default army rather than something bespoke: it's already a legal,
 * balanced 400-point purchase (`engine/army.ts`), it's what the AI was
 * measured against in the fuzz soaks, and giving the computer a *different*
 * army from the one a hurried human picks would quietly make difficulty
 * comparisons mean something else.
 */
export function skipAiArmySeats(fromIndex: number): number | null {
  for (let i = fromIndex; i < session.playerCount; i++) {
    if (!isAiSeat(seatControlFor(i))) return i;
    session.armySelections[i] = defaultArmySelection();
  }
  return null;
}

/**
 * Deploys one seat's whole army onto legal hexes in its own deployment zone,
 * exactly as `PlacementScene` would if a human had clicked each hex. The
 * algorithm - random within the legal set, most-constrained units first, the
 * plateau preference, a random facing for ships - moved to the engine in §72
 * (`engine/deployment.ts`'s `autoDeploy`), so a host without the Phaser scenes
 * deploys the same way; this only reads the seat's army from the session.
 */
export function autoPlaceSeat(state: GameState, playerIndex: number, rng: () => number = Math.random): void {
  autoDeploy(state, playerIndex, session.armySelections[playerIndex] ?? {}, rng);
}

/**
 * Deploys every AI seat from `fromIndex` onward and returns the first seat
 * that still needs a human to place its army — or `null` when none do (in
 * which case the caller goes straight to the Board).
 *
 * `state` must already exist: `PlacementScene.create` is what builds it, on
 * seat 0's pass, so a caller reaching here before that has to create it
 * first (see `MenuScene`/`ArmyBuilderScene`'s hand-off).
 */
export function skipAiPlacementSeats(
  state: GameState,
  fromIndex: number,
  rng: () => number = Math.random,
): number | null {
  for (let i = fromIndex; i < session.playerCount; i++) {
    if (!isAiSeat(seatControlFor(i))) return i;
    autoPlaceSeat(state, i, rng);
  }
  return null;
}
