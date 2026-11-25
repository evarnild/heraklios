import { applyAction, type ActionResult } from '../engine/actions';
import { completeCue, cueBeforeAction, driftClashCue, driftMoveCue } from '../engine/actionCue';
import type { ActionCue } from '../engine/actionCue';
import type { HexCoord } from '../data/map';
import type { Action } from '../engine/actions';
import type { GameState } from '../engine/state';

/**
 * Holds the cue (§66) of the action the Board just applied until the render
 * that shows it takes it: `apply` is `applyAction` that also derives the
 * action's cue (path, clash, shake), and a drift beat sets its own. The scene
 * keeps one so its own code only passes the cue on to the view.
 */
export class CueKeeper {
  private pending: ActionCue | null = null;

  /** `render` draws the board now; a trample's clash needs it before the next beat's cue replaces this one. */
  constructor(private render: () => void) {}

  /** `applyAction`, and remembers the action's cue for the next render. */
  readonly apply: typeof applyAction = ((state: GameState, action: Action, rng?: () => number) => {
    const done = this.begin(state, action);
    const result = applyAction(state, action, rng);
    done(result);
    return result;
  }) as typeof applyAction;

  /**
   * For an action that something else applies (the engine session, §73): the
   * cue is derived now, before the action changes the board, and the returned
   * function completes and remembers it once the action's result is known.
   */
  begin(state: GameState, action: Action): (result: ActionResult) => void {
    const cue = cueBeforeAction(state, action);
    return (result) => {
      this.pending = cue && completeCue(cue, result);
    };
  }

  /** A drift beat entered `hex`. */
  driftMove(elephantId: string, hex: HexCoord): void {
    this.pending = driftMoveCue(elephantId, hex);
  }

  /** A drift trample at `hex`: draws now, so the clash plays before whatever the next beat changes. */
  driftClash(elephantId: string, hex: HexCoord): void {
    this.pending = driftClashCue(elephantId, hex);
    this.render();
  }

  /** The cue for the render that is about to draw, once. */
  take(): ActionCue | null {
    const cue = this.pending;
    this.pending = null;
    return cue;
  }
}
