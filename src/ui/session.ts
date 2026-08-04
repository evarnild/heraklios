import type { ArmySelection } from '../engine/army';
import { emptySelection } from '../engine/army';
import type { CombatMode, GameState, Player, PlayerId } from '../engine/state';

export type Edge = 'N' | 'S' | 'E' | 'W';

export interface SessionState {
  playerCount: number;
  playerNames: string[];
  edges: Edge[]; // edges[i] = edge assigned to player i
  armySelections: ArmySelection[]; // armySelections[i] for player i
  /** Chosen on the Menu screen before starting a game; carried into
   * `createInitialState` when the board is set up. */
  combatMode: CombatMode;
  /**
   * House rule, chosen on the Menu screen before starting a game and carried
   * into `createInitialState`: when true, turn order is reshuffled at the
   * start of each new full turn instead of staying fixed at the seating order
   * drawn during edge assignment. Defaults to false — the rulebook doesn't
   * address this, so the default reproduces today's (fixed-order) behaviour.
   */
  randomizedTurnOrder: boolean;
  /**
   * True when the game was launched via one of the Menu's test-mode
   * shortcuts. Relaxes the undo rule that a die roll is a commit point (see
   * BoardScene's `rollDie`), so the naval/drift code paths can be replayed
   * while developing without restarting a game.
   */
  testMode: boolean;
  gameState: GameState | null;
}

export const session: SessionState = {
  playerCount: 4,
  playerNames: ['Athènes', 'Perse', 'Macédoine', 'Sparte'],
  edges: ['W', 'E', 'N', 'S'],
  armySelections: [],
  combatMode: 'multi-defender',
  randomizedTurnOrder: false,
  testMode: false,
  gameState: null,
};

export function resetSession(playerCount: number): void {
  session.playerCount = playerCount;
  session.testMode = false;
  session.armySelections = Array.from({ length: playerCount }, () => emptySelection());
  session.gameState = null;
  assignEdgesRandomly(playerCount);
}

/** Dice-off: highest 2 rolls choose E/W, remaining 2 get N/S — approximated
 * here as a random assignment (equivalent distribution for a solo/hotseat
 * digital version where every player rolls "at once"). */
function assignEdgesRandomly(playerCount: number): void {
  const allEdges: Edge[] = ['W', 'E', 'N', 'S'];
  // simple shuffle
  for (let i = allEdges.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allEdges[i], allEdges[j]] = [allEdges[j]!, allEdges[i]!];
  }
  session.edges = allEdges.slice(0, playerCount);
}

/**
 * Clears everything that belongs to the game being left, before handing
 * control back to the Menu — called by every "Abandon" control
 * (ArmyBuilder/Placement/Board) and by `GameOverScene`'s "Back to menu"
 * (which had the same latent gap: nothing previously reset `testMode` on
 * that path either).
 *
 * Without this, a finished or abandoned game's leftovers leak into the
 * next one. The concrete failure this guards against: a game launched via
 * one of the Menu's test-mode shortcuts sets `testMode = true`; if a player
 * then abandons it and picks "Charger une partie" to load a *real* saved
 * game instead of starting a fresh one (the only other path out of the
 * Menu that doesn't call `resetSession`), `testMode` would still read
 * `true` for that resumed real game — silently relaxing the "a die roll is
 * an undo boundary" rule (see BoardScene's `rollDie`/`clearHistoryOnRoll`)
 * for a game that never asked for it.
 *
 * Deliberately does NOT touch `playerNames`, `combatMode`, or
 * `randomizedTurnOrder`: those are Menu-chosen preferences meant to persist
 * across games (see `MenuScene`, which never resets them either), not
 * leftovers from the game just left. `playerCount` and `edges` are also
 * left alone — both are fully re-derived by `resetSession` the moment a
 * player picks a player count on the Menu, and nothing reads them before
 * that pick happens.
 */
export function resetToMenu(): void {
  session.gameState = null;
  session.testMode = false;
  session.armySelections = [];
}

export function buildPlayers(): Player[] {
  return Array.from({ length: session.playerCount }, (_, i) => ({
    id: i as PlayerId,
    name: session.playerNames[i]!,
    edge: session.edges[i]!,
    purchasePoints: 400,
    eliminated: false,
  }));
}
