import type { HexCoord } from '../data/map';
import type { PlayerAgent } from './agent';
import {
  completePush,
  legalRetreatHexes,
  pushCandidates,
  retreatUnitTo,
} from './combat';
import type { GameState, Unit } from './state';

export interface RetreatHooks {
  onRetreat?(unit: Unit, hex: HexCoord, isPushedLink: boolean): void;
  onPush?(unit: Unit, pushed: Unit, vacatedHex: HexCoord): void;
  onEliminated?(unit: Unit): void;
}

/**
 * Resolves the whole retreat-or-push cascade for `unit` using the same
 * PlayerAgent decisions as the scene. This is the sequencing glue around
 * `legalRetreatHexes` / `pushCandidates` / `completePush`: if a unit has no
 * direct retreat, it can push a friendly that may itself need to retreat or
 * push first. `visited` prevents cycles in that push chain.
 */
export async function resolveUnitRetreat(
  state: GameState,
  unit: Unit,
  agent: PlayerAgent,
  hooks: RetreatHooks = {},
  visited: ReadonlySet<string> = new Set(),
  resolvedIds?: Set<string>,
): Promise<void> {
  resolvedIds?.add(unit.id);
  const legalHexes = legalRetreatHexes(state, unit);
  if (legalHexes.length > 0) {
    const hex = await agent.chooseRetreat(state, unit, legalHexes);
    retreatUnitTo(unit, hex);
    hooks.onRetreat?.(unit, hex, visited.size > 0);
    return;
  }

  const pushTargets = pushCandidates(state, unit, visited);
  if (pushTargets.length > 0) {
    const pushed = await agent.choosePushTarget(state, unit, pushTargets);
    const vacatedHex = { ...pushed.position };
    const chainVisited = new Set(visited);
    chainVisited.add(unit.id);
    await resolveUnitRetreat(state, pushed, agent, hooks, chainVisited, resolvedIds);
    completePush(unit, vacatedHex);
    hooks.onPush?.(unit, pushed, vacatedHex);
    return;
  }

  unit.destroyed = true;
  hooks.onEliminated?.(unit);
}
