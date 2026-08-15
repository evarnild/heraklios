import { MAP_TERRAIN, hexKey, type HexCoord } from '../data/map';
import { canEnterTerrain } from '../data/terrain';
import { getUnitType } from '../data/units';
import { defaultArmySelection, type ArmySelection } from '../engine/army';
import { unitCategory } from '../engine/movement';
import { isAiSeat } from '../engine/seatControl';
import { maxEquipmentPointsForType, type GameState, type Unit } from '../engine/state';
import { legalDeploymentHexes, legalNavalDeploymentHexes } from './mapBounds';
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

/** Every unit an army selection contains, one entry per individual unit,
 * ordered so the ones with the tightest choice of hex come first — see
 * `keepsOffPlateauxAtDeployment` and `unitsInPlacementOrder`. */
function unitsOf(selection: ArmySelection): string[] {
  const list: string[] = [];
  for (const [typeId, count] of Object.entries(selection)) {
    for (let i = 0; i < (count ?? 0); i++) list.push(typeId);
  }
  return list;
}

/**
 * Whether the AI keeps this unit type off plateaux when it deploys.
 *
 * **This is a tactical preference, NOT a rule.** The rulebook's terrain
 * prohibitions are only the three in `05-rules-french-original.md:186-188`
 * (chariots and cavalry off steep flanks; chariots, cavalry and elephants
 * out of marsh; land units out of the sea), and those live where they
 * belong, in `data/terrain.ts`'s `canEnterTerrain`. A plateau is legal
 * ground for every land unit and stays that way — nothing here changes what
 * a *player* may do, what a unit may move onto, or where a retreat may land.
 * It only changes where the computer chooses to stand at turn zero.
 *
 * The reasoning, recorded because a future reader will otherwise look for a
 * rule that isn't there: a plateau's whole value is defensive, and it is
 * conditional — `+2` to the attacker's die only when the attack comes from
 * below (`data/terrain.ts`, and the same table row the rulebook prints). It
 * is worth having under a unit that intends to be attacked where it stands.
 * Cavalry, chariots and heavy infantry are the arms you deploy to move: a
 * cavalry charge needs a straight run at full movement allowance
 * (`engine/movement.ts`'s `straightLineMoveCost`), so parking them on
 * ground chosen for standing still spends their opening position on a bonus
 * they are meant to leave behind. The units that hold — archers shooting at
 * range, phalanxes, elephants — are the ones that should have the plateaux.
 *
 * Phalanxes are deliberately NOT included, even though they are heavy foot:
 * this covers `fantassins-lourds` specifically, and a phalanx is exactly the
 * unit that does want to stand on defensive ground.
 */
function keepsOffPlateauxAtDeployment(typeId: string): boolean {
  const category = unitCategory(typeId);
  return category === 'cavalry' || category === 'chariot' || typeId === 'fantassins-lourds';
}

/**
 * The order units are deployed in: everything that avoids plateaux first,
 * then the rest.
 *
 * Most-constrained-first, for margin rather than out of tidiness. On the
 * southern band — the worst case on this map — 44 of 126 hexes are plateau
 * and 37 more are steep flanks a chariot may not enter at all, leaving 43
 * plain hexes against a default army's 22 units that want them. In selection
 * order the 10 archers (listed first, and happy anywhere) would draw from the
 * full 87-hex legal set and take some of that plain ground first.
 *
 * **Measured, so the comment doesn't overclaim:** with today's default army
 * this ordering is not strictly necessary — removing it leaves the plateau
 * preference intact across all 20 tested seeds, because the archers only
 * land on plain about half the time and 43 hexes is enough slack to absorb
 * it. It is the margin that stops that from being luck: a heavier cavalry
 * army, a hand-built one, or a tighter band moves the arithmetic, and the
 * failure would be silent (a few chariots on plateaux, indistinguishable
 * from chance). The ordering has its own test for that reason; the plateau
 * test does not depend on it.
 */
function unitsInPlacementOrder(selection: ArmySelection): string[] {
  const all = unitsOf(selection);
  return [...all.filter(keepsOffPlateauxAtDeployment), ...all.filter((t) => !keepsOffPlateauxAtDeployment(t))];
}

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
 * exactly as `PlacementScene.tryPlace`/`confirmPendingShip` would if a human
 * had clicked each hex — same `p<seat>u<n>` id scheme, same `Unit` fields,
 * same terrain rule (`canEnterTerrain`, so no cavalry parked on a marsh),
 * same "one unit per hex" and "keep clear of other armies" constraints
 * (`legalDeploymentHexes`' `minGap`).
 *
 * Placement is random within the legal set rather than positional: a fixed
 * pattern would make every AI game open identically, and the zone's shape
 * already does the useful work of keeping the army together. Ship facing is
 * random too — a ship's facing only matters for ramming geometry, which
 * nothing at deployment time can predict.
 *
 * One tactical preference rides on top of the legality rules: cavalry,
 * chariots and heavy infantry are kept off plateaux where possible — see
 * `keepsOffPlateauxAtDeployment` for why, and for why that is a preference
 * and not a rule. It is a PREFERENCE in the code as well as in the comment:
 * if the band has no non-plateau hex left, the unit takes a plateau rather
 * than the deployment failing, since standing somewhere merely suboptimal
 * beats not fielding the army.
 *
 * Throws if the zone runs out of room before the army is placed, rather than
 * silently deploying a short army: that would hand the human a free win and
 * look like a rules bug from the board.
 */
export function autoPlaceSeat(state: GameState, playerIndex: number, rng: () => number = Math.random): void {
  const player = state.players[playerIndex]!;
  const enemyHexes = state.units.filter((u) => u.owner !== playerIndex).map((u) => u.position);
  const landHexes = legalDeploymentHexes(player.edge, enemyHexes);
  const seaHexes = legalNavalDeploymentHexes(player.edge, enemyHexes);
  const taken = new Set(state.units.filter((u) => !u.destroyed).map((u) => hexKey(u.position.q, u.position.r)));

  /**
   * Draws a hex, preferring `preferred` and falling back to the full legal
   * `candidates` when none of the preferred ones are free. Exactly one
   * `rng()` call either way, so the fallback doesn't shift the random
   * sequence relative to a run that never needs it.
   */
  const pick = (candidates: HexCoord[], preferred?: HexCoord[]): HexCoord => {
    const free = (hexes: HexCoord[]) => hexes.filter((h) => !taken.has(hexKey(h.q, h.r)));
    const freePreferred = preferred ? free(preferred) : [];
    const pool = freePreferred.length > 0 ? freePreferred : free(candidates);
    if (pool.length === 0) {
      throw new Error(`autoPlaceSeat: seat ${playerIndex} has no legal hex left to deploy on`);
    }
    return pool[Math.floor(rng() * pool.length)]!;
  };

  let counter = 0;
  for (const typeId of unitsInPlacementOrder(session.armySelections[playerIndex] ?? {})) {
    const type = getUnitType(typeId);
    const naval = type.domain === 'naval';
    const candidates = naval
      ? seaHexes
      : landHexes.filter((h) => {
          const terrain = MAP_TERRAIN.get(hexKey(h.q, h.r));
          return terrain !== undefined && canEnterTerrain(terrain, unitCategory(typeId));
        });
    const preferred =
      !naval && keepsOffPlateauxAtDeployment(typeId)
        ? candidates.filter((h) => MAP_TERRAIN.get(hexKey(h.q, h.r)) !== 'plateau')
        : undefined;
    const hex = pick(candidates, preferred);
    taken.add(hexKey(hex.q, hex.r));
    const unit: Unit = {
      id: `p${playerIndex}u${counter++}`,
      owner: playerIndex as 0 | 1 | 2 | 3,
      typeId,
      position: hex,
      movementLeft: type.movement,
      facing: naval ? Math.floor(rng() * 6) : 0,
      equipmentPoints: naval ? maxEquipmentPointsForType(type) : undefined,
      defendedThisPhase: false,
      charged: false,
      destroyed: false,
    };
    state.units.push(unit);
  }
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
