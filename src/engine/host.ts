import type { ArmySelection } from './army';
import { autoDeploy, deployUnit, type DeployError, type DeployRequest, type Edge } from './deployment';
import type { Question, SessionEvent } from './combatResolution';
import {
  newSession,
  sessionApply,
  sessionLegalActions,
  sessionQuestion,
  type GameSession,
  type SessionAction,
} from './gameSession';
import { createSeededRng } from './rng';
import { buildSavedGame, parseSavedGame, type SavedGame } from './saveGame';
import type { SeatControl } from './seatControl';
import type { ActionResult } from './actions';
import type { CombatMode, GameState, Player, PlayerId } from './state';
import { createInitialState } from './turnManager';

/**
 * The supported entry for a host other than the Phaser scenes (§72, B13): one
 * module that deploys a game, offers its legal actions, applies an action or an
 * answer, and saves and loads it. Every input and output is a JSON value - a
 * host in another language or process need only speak JSON - and every output
 * is a copy, so nothing a caller holds can reach into the game.
 *
 * Its rng is the seeded LCG (`engine/rng.ts`), required, and shared by the
 * deployment and every roll after it; nothing on this path calls
 * `Math.random`. `save()` stamps `savedAt` with the wall clock, which is not
 * game behaviour.
 *
 * It sits in the engine, not in a new layer (principle 17): it imports only
 * engine modules.
 */

export interface HostPlayerConfig {
  name: string;
  edge: Edge;
  army: ArmySelection;
  /** Explicit placements, each checked by `deployUnit`. They need not cover
   * the whole army (the Placement screen also lets a player finish early).
   * Absent, the seat is deployed by `autoDeploy`. */
  placements?: DeployRequest[];
}

export interface HostConfig {
  players: HostPlayerConfig[];
  /** A permutation of the seat ids, 0 to players-1; defaults to player order. */
  seatOrder?: PlayerId[];
  options?: {
    combatMode?: CombatMode;
    randomizedTurnOrder?: boolean;
    clockLimitMs?: number | null;
    roundLimit?: number | null;
    allowSwaps?: boolean;
  };
  /** Only recorded into `save()`; the host itself plays no seat. Defaults to
   * all 'human'. */
  seatControls?: SeatControl[];
}

/** A configured placement that `deployUnit` refused, with its reason as data. */
export class HostDeployError extends Error {
  constructor(
    readonly seat: number,
    readonly request: DeployRequest,
    readonly deployError: DeployError,
  ) {
    super(`newGame: seat ${seat} could not place ${request.typeId}: ${deployError.kind}`);
  }
}

export interface HostStep {
  /** What `applyAction` returned, as JSON; `{kind: 'answer'}` for an answer. */
  result: ActionResult | { kind: 'answer' };
  events: SessionEvent[];
  /** The question now open, or null. */
  question: Question | null;
}

export interface Host {
  /** With no question open, `legalActions` as the engine lists them; with one
   * open, exactly its answers. */
  legalActions(): SessionAction[];
  /** Applies a turn action or an answer. A turn action is checked only by
   * `applyAction`'s own errors, so a combined attack is accepted (A3). */
  apply(action: SessionAction): HostStep;
  question(): Question | null;
  state(): GameState;
  /** A `SavedGame` in today's format. Refused while a question is open. */
  save(): SavedGame;
}

/** What `save()` needs beyond the game itself. */
interface SaveSetup {
  playerNames: string[];
  edges: Edge[];
  armySelections: ArmySelection[];
  seatControls: SeatControl[];
  testMode: boolean;
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function requireSeed(seed: number): void {
  if (typeof seed !== 'number' || !Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new Error(`host: the seed must be a finite integer, got ${String(seed)}`);
  }
}

function hostFor(session: GameSession, rng: () => number, setup: SaveSetup): Host {
  return {
    legalActions: () => copy(sessionLegalActions(session)),
    apply(action) {
      const step = sessionApply(session, copy(action), rng);
      return copy({ result: step.result, events: step.events, question: sessionQuestion(session) });
    },
    question: () => copy(sessionQuestion(session)),
    state: () => copy(session.state),
    save() {
      if (session.pending) throw new Error('host.save: a question is open; answer it before saving');
      return copy(
        buildSavedGame({
          savedAt: new Date().toISOString(),
          playerCount: setup.playerNames.length,
          playerNames: setup.playerNames,
          edges: setup.edges,
          armySelections: setup.armySelections,
          combatMode: session.state.combatMode,
          seatControls: setup.seatControls,
          testMode: setup.testMode,
          gameState: session.state,
          attackedThisPhase: session.context.attackedThisPhase,
          rammedThisTurn: session.context.rammedThisTurn,
        }),
      );
    },
  };
}

function checkSeatOrder(seatOrder: readonly PlayerId[], players: number): void {
  const sorted = [...seatOrder].sort((a, b) => a - b);
  if (sorted.length !== players || sorted.some((id, i) => id !== i)) {
    throw new Error(`newGame: seatOrder must be a permutation of 0..${players - 1}`);
  }
}

/** Deploys every seat in index order: the config's placements, or `autoDeploy`. */
function deployAll(state: GameState, config: HostConfig, rng: () => number): void {
  config.players.forEach((player, seat) => {
    if (!player.placements) {
      autoDeploy(state, seat, player.army, rng);
      return;
    }
    for (const request of player.placements) {
      const placed = deployUnit(state, seat, copy(request));
      if (!placed.ok) throw new HostDeployError(seat, request, placed.error);
    }
  });
}

/**
 * Starts a game: `createInitialState`, the optional seat order, then each
 * seat's deployment. Armies are not re-checked with `validateArmy`, as
 * `autoPlaceSeat` never did; `purchasePoints` is 400, as in `buildPlayers`.
 * Units come out of `deployUnit` with their full movement, so no
 * `resetMovementForActivePlayer` is needed before the first phase.
 */
export function newGame(config: HostConfig, seed: number): Host {
  requireSeed(seed);
  const cfg = copy(config);
  const players: Player[] = cfg.players.map((p, i) => ({
    id: i as PlayerId,
    name: p.name,
    edge: p.edge,
    purchasePoints: 400,
    eliminated: false,
  }));
  const o = cfg.options ?? {};
  const state = createInitialState(
    players,
    o.combatMode ?? 'multi-defender',
    o.randomizedTurnOrder ?? false,
    o.clockLimitMs ?? null,
    o.roundLimit ?? null,
    o.allowSwaps ?? true,
  );
  if (cfg.seatOrder) {
    checkSeatOrder(cfg.seatOrder, players.length);
    state.seatOrder = [...cfg.seatOrder];
  }
  const rng = createSeededRng(seed);
  deployAll(state, cfg, rng);
  return hostFor(newSession(state), rng, {
    playerNames: players.map((p) => p.name),
    edges: players.map((p) => p.edge),
    armySelections: cfg.players.map((p) => p.army),
    seatControls: cfg.seatControls ?? players.map(() => 'human'),
    testMode: false,
  });
}

/**
 * Resumes a saved game (its JSON text, or the parsed value), with the
 * attacked/rammed sets from the save. A `SavedGame` holds no rng position and
 * the format does not change, so the caller supplies the seed.
 */
export function load(savedJson: string | SavedGame, seed: number): Host {
  requireSeed(seed);
  const parsed = parseSavedGame(typeof savedJson === 'string' ? savedJson : JSON.stringify(savedJson));
  if ('error' in parsed) throw new Error(`host.load: ${parsed.error.kind}`);
  const { save } = parsed;
  const session = newSession(save.gameState, {
    attackedThisPhase: save.attackedThisPhase,
    rammedThisTurn: save.rammedThisTurn,
  });
  return hostFor(session, createSeededRng(seed), {
    playerNames: save.playerNames,
    edges: save.edges,
    armySelections: save.armySelections,
    seatControls: save.seatControls,
    testMode: save.testMode,
  });
}
