import type { ArmySelection } from '../engine/army';
import { emptySelection } from '../engine/army';
import { normalizeSeatControls, type SeatControl } from '../engine/seatControl';
import type { CombatMode, GameState, Player, PlayerId } from '../engine/state';

export type Edge = 'N' | 'S' | 'E' | 'W';

/** Seats the Menu can configure. `playerCount` selects the first N of them,
 * exactly as it already does for `playerNames`. */
export const MAX_PLAYERS = 4;

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
   * Who plays each seat — human, or one of the three AI difficulty tiers
   * (plan.md §6.4's Stage 4). Chosen on the Menu screen before starting a
   * game and read by `ArmyBuilderScene`/`PlacementScene` (which skip an AI
   * seat's setup) and `BoardScene` (which drives it).
   *
   * ALWAYS `MAX_PLAYERS` long, regardless of `playerCount`, so the Menu can
   * offer all four before the player has picked a count — `seatControls[i]`
   * is meaningful only for `i < playerCount`, same convention `playerNames`
   * already uses. Like `combatMode`/`randomizedTurnOrder` (and unlike
   * `armySelections`), it's a sticky Menu preference: neither `resetSession`
   * nor `resetToMenu` clears it, so setting up "me vs. a hard AI" once
   * survives into the next game.
   */
  seatControls: SeatControl[];
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
  seatControls: Array.from({ length: MAX_PLAYERS }, (): SeatControl => 'human'),
  testMode: false,
  gameState: null,
};

/** Reads a seat's control defensively — a loaded save can carry a shorter
 * `seatControls` than the current `playerCount` if it was hand-edited, and an
 * unconfigured seat is a human one. */
export function seatControlFor(playerIndex: number): SeatControl {
  return session.seatControls[playerIndex] ?? 'human';
}

/** Overwrites `seatControls` from an untrusted source (a loaded save), padded
 * to `MAX_PLAYERS` so the Menu always has all four to offer afterwards. */
export function setSeatControls(controls: unknown): void {
  session.seatControls = normalizeSeatControls(controls, MAX_PLAYERS);
}

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
 * (which had the same latent gap: nothing previously reset session state on
 * that path either, it just happened to never matter because a finished
 * game is never resumed).
 *
 * Every one of the three ways to actually *start* a game already
 * re-initializes `gameState`/`testMode` itself before Board becomes
 * reachable — `resetSession` (a fresh player-count pick), the test-mode
 * shortcuts in `testMode.ts` (`startTestGame`/`startCloseCombatTestGame`),
 * and `applySavedGame` (loading a save) — so on its own this function isn't
 * fixing a reachable bug in those three fields *today*. It exists as the
 * single, tested place that makes "an abandoned game's state cannot outlive
 * the abandon" an invariant rather than something that happens to hold
 * because three unrelated call sites are each individually careful,
 * which is exactly the kind of thing that quietly stops being true the next
 * time one of those three paths changes.
 *
 * `armySelections` is the one field where the leak was concretely
 * reachable: the test-mode shortcuts (`testMode.ts`) deliberately skip
 * `resetSession` and build their armies directly rather than from
 * `armySelections`. Abandon a real game mid-`ArmyBuilder`/`Placement`/
 * `Board` — `session.armySelections` still holds that game's
 * `playerCount`-length selections — then launch a test-mode game instead of
 * a real one, and its first autosave (`BoardScene.autosave`, unconditional
 * once `resetSceneState` has cleared the flags it's guarded on) or manual
 * save would bake that stale, WRONG `armySelections` into the SavedGame
 * alongside the test game's own (different) `playerCount` and units — see
 * `saveStorage.ts`'s `captureCurrentGame`, which reads `session.armySelections`
 * with no awareness of which game populated it. This function alone closes
 * that: `armySelections` is `[]` at module load (see `session`'s initial
 * value above), and clearing it back to `[]` here just restores that
 * day-one state before the next game gets a chance to read it, rather than
 * leaving the abandoned game's real selections in place for something else
 * to pick up by accident.
 *
 * Separately — NOT required to close the leak above, since `[]` was never
 * wrong, just unused by test-mode games — `testMode.ts`'s shortcuts also now
 * size `armySelections` to match their OWN `playerCount`. `[]` next to
 * `playerCount: 2` is a length mismatch too, just one that's always been
 * there for a cold "Mode test" launch straight from the Menu (nothing ever
 * populated it for that path) and is harmless since nothing reads
 * `armySelections` in test mode. Worth tidying since this feature's own
 * test (`session.test.ts`) made the mismatch newly visible and easy to
 * assert against, not because it was a reachable bug on its own.
 *
 * Deliberately does NOT touch `playerNames`, `combatMode`,
 * `randomizedTurnOrder`, or `seatControls`: these are meant to persist across games as the
 * Menu's own sticky preferences (see `MenuScene`, which never resets them
 * either) — NOT necessarily "chosen on the Menu" for the game just
 * abandoned specifically, since `applySavedGame` also overwrites
 * `combatMode`/`randomizedTurnOrder` from whatever a *loaded* save carried.
 * So abandoning a loaded single-defender-rule game, say, does leave
 * single-defender as the Menu's preference for the next game too — a
 * genuine carry-over, but not a silent one: it's the same toggle visible
 * (and changeable) right there on the Menu screen, not a value some other
 * game's leftover state quietly overrides underneath the player —
 * `seatControls` joins them on exactly that footing, and is likewise
 * overwritten by a loaded save (see `applySavedGame`). `playerCount`
 * and `edges` are also left alone — both are fully re-derived by
 * `resetSession` the moment a player picks a player count on the Menu, and
 * nothing reads them before that pick happens.
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
