/**
 * A bounded undo/redo history of opaque snapshots.
 *
 * Deliberately generic and free of game or Phaser types: each caller decides
 * what a snapshot *is* and this class only sequences them. Snapshots are
 * stored exactly as handed over — cloning is the caller's job, since only the
 * caller knows which parts of its payload are live references that must be
 * copied rather than aliased.
 *
 * The scenes use it in the "memento" style rather than as a command stack:
 * game state is mutated in place across dozens of sites, so capturing the
 * whole state before an action is far more robust than maintaining an inverse
 * operation per action.
 */

export interface Snapshot<T> {
  payload: T;
  /**
   * Human-readable description of the action this snapshot sits *before*,
   * e.g. "Move fantassins" — shown on the Undo/Redo buttons so the player
   * knows what they're about to take back.
   */
  label: string;
}

export const DEFAULT_HISTORY_CAPACITY = 100;

export class History<T> {
  private undoStack: Snapshot<T>[] = [];
  private redoStack: Snapshot<T>[] = [];

  constructor(private readonly capacity: number = DEFAULT_HISTORY_CAPACITY) {}

  /**
   * Records the state as it was *before* an action, labeled with that action.
   * Performing a new action invalidates any redo history (the standard undo
   * model: once you diverge, the old forward path is gone). Oldest entries
   * are dropped past `capacity`.
   */
  push(payload: T, label: string): void {
    this.undoStack.push({ payload, label });
    if (this.undoStack.length > this.capacity) this.undoStack.shift();
    this.redoStack = [];
  }

  /**
   * Steps back one action. `current` — the state being left behind — moves
   * onto the redo stack, and the snapshot to restore is returned. Null when
   * there is nothing to undo, so callers can treat that as "button disabled".
   */
  undo(current: T): Snapshot<T> | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push({ payload: current, label: entry.label });
    return entry;
  }

  /** The mirror of `undo`: re-applies the most recently undone action. */
  redo(current: T): Snapshot<T> | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push({ payload: current, label: entry.label });
    return entry;
  }

  /**
   * Drops all history in both directions — used at boundaries past which
   * undo must not reach: a phase change, and (outside test mode) any die
   * roll, since re-rolling a committed result would be save-scumming.
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Label of the action `undo()` would take back, for the button text. */
  get undoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }

  /** Label of the action `redo()` would re-apply, for the button text. */
  get redoLabel(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null;
  }

  get depth(): number {
    return this.undoStack.length;
  }
}
