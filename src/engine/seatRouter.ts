import type { HexCoord } from '../data/map';
import type { PlayerAgent } from './agent';
import type { GameState, PlayerId, Unit } from './state';

/**
 * A `PlayerAgent` that forwards each mid-resolution decision to the agent of
 * the seat that decision belongs to, falling back to `fallback` for any seat
 * with no agent of its own.
 *
 * The rule this encodes is the whole point, and it is easy to get subtly
 * wrong: these questions are NOT all addressed to the active player.
 * `applyLandCombatResult` hands the DEFENDER a retreat to choose while the
 * attacker is the one whose turn it is, and an elephant drifting through a
 * third player's line asks THAT player where their trampled unit retreats to.
 * Answering any of them with the active seat's agent would quietly have one
 * player play both sides — invisible in a hotseat game (where one human
 * answers everything anyway) and wrong the moment two seats are played
 * differently.
 *
 * `fallback` exists because `BoardScene` is itself a `PlayerAgent`: a mixed
 * game routes an AI seat's decisions to its `HeuristicAgent` and a human
 * seat's to the scene's own click prompts, with no special-casing at either
 * end. `fuzzHarness.ts`'s `SeatAgentRouter` is the fully-headless sibling of
 * this — same rule, but `DrivingAgent`-shaped because a headless driver also
 * picks top-level actions, which `BoardScene` deliberately cannot (see
 * `ActionObserver`'s doc comment in agent.ts).
 */
export function routeBySeat(
  agents: ReadonlyMap<PlayerId, PlayerAgent>,
  fallback: PlayerAgent,
): PlayerAgent {
  const forSeat = (owner: PlayerId): PlayerAgent => agents.get(owner) ?? fallback;
  return {
    chooseRetreat: (state: GameState, unit: Unit, options: HexCoord[]) =>
      forSeat(unit.owner).chooseRetreat(state, unit, options),

    choosePushTarget: (state: GameState, unit: Unit, candidates: Unit[]) =>
      forSeat(unit.owner).choosePushTarget(state, unit, candidates),

    // Every advance candidate comes from a single attack group, so they share
    // an owner, and the callers never pass an empty list (both
    // `eligibleAdvanceCandidates` results are checked for emptiness first).
    chooseAdvance: (state: GameState, candidates: Unit[], vacated: HexCoord) =>
      forSeat(candidates[0]!.owner).chooseAdvance(state, candidates, vacated),

    // Likewise: an exchange sacrifice is always chosen from one side's own
    // attackers, so the first one names the seat being asked.
    chooseExchangeSacrifice: (state: GameState, attackers: Unit[], requiredForce: number) =>
      forSeat(attackers[0]!.owner).chooseExchangeSacrifice(state, attackers, requiredForce),
  };
}
