import { MAP_TERRAIN, hexKey } from '../data/map';
import type { HexCoord } from '../data/map';
import { canEnterTerrain, isSeaLike } from '../data/terrain';
import type { TerrainType } from '../data/terrain';
import { getUnitType } from '../data/units';
import type { ArmySelection } from './army';
import { hexDistance } from './hex';
import { maxEquipmentPointsForType, unitCategory, type GameState, type Unit } from './state';

/**
 * Where a seat may deploy and how a unit is deployed (§72). The zone rules
 * moved here verbatim from `ui/mapBounds.ts`, which re-exports them, so a
 * host without the Phaser scenes deploys by the same rules as the Placement
 * screen. They live in the engine rather than in `data`: the gap rule needs
 * `hexDistance`, and the zones are rules computed from the map, not a table.
 */

export type Edge = 'N' | 'S' | 'E' | 'W';

/** All playable hexes, parsed once from the terrain map's string keys. */
export function allHexes(): HexCoord[] {
  const hexes: HexCoord[] = [];
  for (const key of MAP_TERRAIN.keys()) {
    const [q, r] = key.split(',').map(Number);
    hexes.push({ q: q!, r: r! });
  }
  return hexes;
}

const DEPTH = 3; // "a strip no more than 3 hexes wide" (docs/research/02-rules-transcription.md)

/**
 * The full-length, `DEPTH`-hex-deep land band along a compass edge.
 *
 * N/S is handled with exact per-column arithmetic: hexes are bucketed by `q`
 * (a fixed-`q` "column" runs due north-south, since `r`±1 is always a direct
 * hex-grid neighbor there — see `engine/hex.ts`'s `DIRECTIONS`, which
 * includes `{q:0,r:±1}`), and each column's nearest hexes are taken by
 * sorting on `r`.
 *
 * W/E can't reuse that trick as a single bucket: flat-top hexes have no
 * fixed-`r` axis with the same property (`{q:1,r:0}`/`{q:-1,r:0}` are valid
 * neighbor directions, but per `hexToPixel`'s `y = k*(2r+q)` they still
 * shift `y` — every direction that changes `q` shifts the along-edge
 * position too). Bucketing by the exact along-edge coordinate `2r+q` still
 * works, but each such bucket, by construction, only contains every OTHER
 * `q` (since `r=(bucket-q)/2` needs `q` to share the bucket's parity) — so
 * hexes within one bucket are 2 real hex-steps apart. Merging each pair of
 * adjacent buckets (`2k` and `2k+1`) into one along-edge group interleaves
 * them back into consecutive `q` values, matching how a hex "row" is
 * visually two staggered sub-lattices one hex-height apart.
 *
 * Either way, a bucket isn't just "sorted, take the nearest `DEPTH`": this
 * map's coastline isn't convex (it's built around a central bay, with 4
 * named inlets — see `docs/research/01-history-and-background.md`), so a
 * column/group can contain a short strip of land near the edge, open water,
 * and then more land further out on the far side of a bay. Taking the
 * nearest 3 by sort order alone would leap across that gap and include the
 * unconnected far strip as if it were part of the deployable coastal band.
 * Each bucket is walked outward from the edge instead, stopping either at
 * `DEPTH` hexes *examined* or as soon as the depth coordinate skips (a gap of
 * more than 1), whichever comes first.
 *
 * **The walk counts every hex it passes, not just land ones.** An earlier
 * version filtered sea/coast/naval-zone hexes out before bucketing, so the
 * `DEPTH` budget was only spent on land — a bucket whose nearest 1-3 hexes
 * were coast or open water (the fringe of a bay) let the walk tunnel straight
 * through them at no cost and keep going until it found land, however far
 * inland that was. On the shipped map this reached clean across the Cap
 * Zénon and Pointe d'Eole bays to unrelated land on the far shore — a live
 * defect, reported by a player deploying on the east edge and getting hexes
 * as far away as column 22 (the map's east edge is columns 40-42). Counting
 * every examined hex, land or not, toward `DEPTH` keeps the walk within the
 * true 3-hex-deep strip from the edge; a row whose first `DEPTH` hexes are
 * all coast/sea simply contributes no deployable hexes, rather than reaching
 * past them.
 */
function depthBand(edge: Edge): HexCoord[] {
  const hexes = allHexes();

  const isVertical = edge === 'N' || edge === 'S';
  const buckets = new Map<number, HexCoord[]>();
  for (const h of hexes) {
    const bucket = isVertical ? h.q : Math.floor((2 * h.r + h.q) / 2);
    const list = buckets.get(bucket);
    if (list) list.push(h);
    else buckets.set(bucket, [h]);
  }

  // Ascending = nearer the edge first; consecutive entries a real single
  // hex-step apart differ by exactly 1 (see the doc comment above).
  const signedDepth = (h: HexCoord): number => {
    if (edge === 'N') return h.r;
    if (edge === 'S') return -h.r;
    return edge === 'W' ? h.q : -h.q;
  };

  const result: HexCoord[] = [];
  for (const bucket of [...buckets.keys()].sort((a, b) => a - b)) {
    const sorted = buckets.get(bucket)!.sort((a, b) => signedDepth(a) - signedDepth(b));
    let previousDepth: number | null = null;
    let examined = 0;
    for (const h of sorted) {
      if (examined >= DEPTH) break;
      const depth = signedDepth(h);
      if (previousDepth !== null && depth - previousDepth > 1) break; // open water — stop here
      const terrain = MAP_TERRAIN.get(`${h.q},${h.r}`)!;
      if (!isSeaLike(terrain) && terrain !== 'coast') result.push(h);
      previousDepth = depth;
      examined++;
    }
  }
  return result;
}

/** The full-length, 3-hex-deep land band along `edge` — the rulebook only
 * bounds a deployment strip's DEPTH (3 hexes, `docs/research/02-rules-transcription.md`),
 * not how far along the edge a player may spread out, so a player's
 * available deployment area is simply this whole band. Memoized: the map is
 * static for the process lifetime, and the placement UI recomputes this
 * (indirectly, via `legalDeploymentHexes`) on every render. */
const bandCache = new Map<Edge, HexCoord[]>();

export function deploymentBand(edge: Edge): HexCoord[] {
  const cached = bandCache.get(edge);
  if (cached) return cached;
  const band = depthBand(edge);
  bandCache.set(edge, band);
  return band;
}

/** Each compass edge's assigned named bay for fleet deployment — "each player
 * deploys their fleet (if any) in the corresponding named sea zone"
 * (`docs/research/02-rules-transcription.md`): west → Anse d'Hypnos, south →
 * Pointe d'Eole, north → Baie d'Argos, east → Cap Zénon. Unlike the land
 * band, this is NOT "nearest sea hexes to the edge" — it's one specific
 * named zone per edge, painted into the map data (`data/map.ts`) — so it has
 * to be looked up rather than derived from geometry. */
const EDGE_NAVAL_ZONE: Record<Edge, TerrainType> = {
  W: 'zone-anse-hypnos',
  S: 'zone-pointe-eole',
  N: 'zone-baie-argos',
  E: 'zone-cap-zenon',
};

const navalBandCache = new Map<Edge, HexCoord[]>();

/**
 * The hexes of `edge`'s assigned named bay — the only hexes a fleet may
 * start in: "no ship may be placed in the coastal fringe... or in
 * open/high seas... only in its assigned medium-blue deployment zone"
 * (`docs/research/02-rules-transcription.md`). Memoized like `deploymentBand`.
 */
export function navalDeploymentBand(edge: Edge): HexCoord[] {
  const cached = navalBandCache.get(edge);
  if (cached) return cached;
  const zoneTerrain = EDGE_NAVAL_ZONE[edge];
  const band = allHexes().filter((h) => MAP_TERRAIN.get(`${h.q},${h.r}`) === zoneTerrain);
  navalBandCache.set(edge, band);
  return band;
}

/**
 * Filters `band` down to hexes at least `minGap` hexes (axial distance, see
 * `engine/hex.ts`'s `hexDistance`) from every hex in `enemyHexes` — the
 * rulebook's "a minimum gap of 4 hexes must separate two different armies at
 * the start" (`docs/research/02-rules-transcription.md`), read literally:
 * exactly 4 is the tightest still-legal placement, 1-3 is a violation.
 * `enemyHexes` should be other players' already-placed units, not this
 * player's own (the gap rule is between different armies, not within one).
 *
 * If `band` is entirely boxed in (every hex within `minGap` of some enemy
 * unit — only plausible on a very cramped edge, or a bay small enough that
 * one ship blocks the rest of it), the gap constraint is dropped rather than
 * returning an empty, unplaceable set: the rulebook doesn't say what should
 * happen if a player's deployment area is boxed in, and a placement screen
 * with nowhere to click would soft-lock the game.
 */
function excludeTooClose(band: readonly HexCoord[], enemyHexes: readonly HexCoord[], minGap: number): HexCoord[] {
  if (enemyHexes.length === 0) return [...band];
  const clear = band.filter((h) => enemyHexes.every((e) => hexDistance(h, e) >= minGap));
  return clear.length > 0 ? clear : [...band];
}

/** Land hexes along `edge` where a land unit may be placed right now — see
 * `excludeTooClose` for the gap rule this applies. */
export function legalDeploymentHexes(edge: Edge, enemyHexes: readonly HexCoord[], minGap = 4): HexCoord[] {
  return excludeTooClose(deploymentBand(edge), enemyHexes, minGap);
}

/** Bay hexes along `edge` where a ship may be placed right now — see
 * `excludeTooClose` for the gap rule this applies. */
export function legalNavalDeploymentHexes(edge: Edge, enemyHexes: readonly HexCoord[], minGap = 4): HexCoord[] {
  return excludeTooClose(navalDeploymentBand(edge), enemyHexes, minGap);
}

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

/** Why a unit could not be deployed, as data - the presentation writes the
 * sentence. */
export type DeployError =
  | { kind: 'illegalHex'; hex: HexCoord }
  | { kind: 'terrain'; typeId: string; hex: HexCoord }
  | { kind: 'occupied'; hex: HexCoord }
  | { kind: 'facing'; facing: number | undefined };

export type DeployResult = { ok: true; unit: Unit } | { ok: false; error: DeployError };

export interface DeployRequest {
  typeId: string;
  hex: HexCoord;
  /** A ship's facing, 0-5. Ignored for a land unit, which starts at 0. */
  facing?: number;
}

/**
 * Places one unit for `playerIndex` and pushes it into `state.units`, or
 * returns why it cannot be, leaving `state` untouched. The rules are the
 * Placement screen's: a hex of the seat's own deployment zone for the unit's
 * domain (the 3-hex band for land, the edge's named bay for ships, with the
 * 4-hex gap from other armies and its fallback), terrain the unit may enter
 * (`canEnterTerrain`; ships stand in the bay, so there is nothing to check),
 * no stacking, and a ship's facing chosen, 0-5.
 *
 * The id is `p${seat}u${n}` where `n` is the number of units the seat already
 * has in `state` (§72 A4). That is `autoDeploy`'s scheme; a second human seat
 * in Placement used to continue a counter, and now restarts at 0. Ids are
 * never shown, and the seat in the id keeps them unique.
 */
export function deployUnit(state: GameState, playerIndex: number, request: DeployRequest): DeployResult {
  const player = state.players[playerIndex]!;
  const type = getUnitType(request.typeId);
  const naval = type.domain === 'naval';
  const { hex } = request;
  const enemyHexes = state.units.filter((u) => u.owner !== playerIndex).map((u) => u.position);
  const legal = naval
    ? legalNavalDeploymentHexes(player.edge, enemyHexes)
    : legalDeploymentHexes(player.edge, enemyHexes);
  if (!legal.some((h) => h.q === hex.q && h.r === hex.r)) return { ok: false, error: { kind: 'illegalHex', hex } };

  if (!naval) {
    const terrain = MAP_TERRAIN.get(hexKey(hex.q, hex.r));
    if (terrain === undefined || !canEnterTerrain(terrain, unitCategory(request.typeId))) {
      return { ok: false, error: { kind: 'terrain', typeId: request.typeId, hex } };
    }
  }
  if (state.units.some((u) => !u.destroyed && u.position.q === hex.q && u.position.r === hex.r)) {
    return { ok: false, error: { kind: 'occupied', hex } };
  }
  const facing = request.facing;
  if (naval && (facing === undefined || !Number.isInteger(facing) || facing < 0 || facing > 5)) {
    return { ok: false, error: { kind: 'facing', facing } };
  }

  const unit: Unit = {
    id: `p${playerIndex}u${state.units.filter((u) => u.owner === playerIndex).length}`,
    owner: playerIndex as 0 | 1 | 2 | 3,
    typeId: request.typeId,
    position: { q: hex.q, r: hex.r },
    movementLeft: type.movement,
    facing: naval ? facing! : 0,
    equipmentPoints: naval ? maxEquipmentPointsForType(type) : undefined,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
  state.units.push(unit);
  return { ok: true, unit };
}

/**
 * Deploys one seat's whole army onto legal hexes in its own deployment zone,
 * exactly as the Placement screen would if a player had clicked each hex -
 * same `p<seat>u<n>` id scheme, same `Unit` fields, same terrain rule
 * (`canEnterTerrain`, so no cavalry parked on a marsh), same "one unit per
 * hex" and "keep clear of other armies" constraints (`legalDeploymentHexes`'
 * `minGap`). This is `ui/aiSetup.ts`'s `autoPlaceSeat`, moved here (§72);
 * `rng` is required because a host owns its randomness.
 *
 * Placement is random within the legal set rather than positional: a fixed
 * pattern would make every game open identically, and the zone's shape
 * already does the useful work of keeping the army together. Ship facing is
 * random too - a ship's facing only matters for ramming geometry, which
 * nothing at deployment time can predict. Each unit draws one `rng()` for its
 * hex and, for a ship, one more for its facing, in that order.
 *
 * One tactical preference rides on top of the legality rules: cavalry,
 * chariots and heavy infantry are kept off plateaux where possible - see
 * `keepsOffPlateauxAtDeployment` for why, and for why that is a preference
 * and not a rule. It is a PREFERENCE in the code as well as in the comment:
 * if the band has no non-plateau hex left, the unit takes a plateau rather
 * than the deployment failing, since standing somewhere merely suboptimal
 * beats not fielding the army.
 *
 * Throws if the zone runs out of room before the army is placed, rather than
 * silently deploying a short army: that would hand the other side a free win
 * and look like a rules bug from the board.
 */
export function autoDeploy(state: GameState, playerIndex: number, selection: ArmySelection, rng: () => number): void {
  if (typeof rng !== 'function') throw new Error('autoDeploy: an rng is required');
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
      throw new Error(`autoDeploy: seat ${playerIndex} has no legal hex left to deploy on`);
    }
    return pool[Math.floor(rng() * pool.length)]!;
  };

  for (const typeId of unitsInPlacementOrder(selection)) {
    const naval = getUnitType(typeId).domain === 'naval';
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
    const facing = naval ? Math.floor(rng() * 6) : undefined;
    const placed = deployUnit(state, playerIndex, { typeId, hex, facing });
    if (!placed.ok) throw new Error(`autoDeploy: seat ${playerIndex} could not deploy ${typeId}: ${placed.error.kind}`);
  }
}
