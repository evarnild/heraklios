import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, RIVER_HEXSIDES, riverEdgeKey, hexKey as mapHexKey } from '../data/map';
import { TERRAIN_EFFECTS, RIVER_CROSSING, canEnterTerrain, isSeaLike, type TerrainType } from '../data/terrain';
import { resolveLandCombat, ratioToColumnIndex, RATIO_COLUMNS, type CombatResult } from '../data/combatTable';
import { isRammingSuccessful, type ShipTypeId } from '../data/navalRamming';
import { resolveBoarding, type BoardingResult } from '../data/navalBoarding';
import { hexAdd, hexDistance, hexEquals, areFacingsParallel, DIRECTIONS } from './hex';
import {
  type GameState,
  type Unit,
  type CombatMode,
  unitType,
  unitCategory,
  currentAttack,
  currentRangedAttack,
  currentDefense,
} from './state';

export function terrainAt(hex: HexCoord): TerrainType {
  return MAP_TERRAIN.get(mapHexKey(hex.q, hex.r)) ?? 'plain';
}

/**
 * Whether `unit` could physically occupy `hex` at all (on the map, terrain
 * its category can enter), ignoring occupancy/ZOC — a general-purpose
 * predicate any "can this specific unit go here" caller can share rather
 * than re-deriving `MAP_TERRAIN` lookup + `unitCategory` + `canEnterTerrain`
 * itself.
 *
 * Written for the post-combat "advance into the vacated hex" offer (see
 * `PlayerAgent.chooseAdvance` in engine/agent.ts): the hex a defeated or
 * retreating defender just vacated was legal for THAT unit's category, not
 * necessarily for whichever attacker is being offered the chance to advance
 * into it — the advance-offer sibling of the terrain gaps the Stage 2 fuzz
 * harness found in `legalRetreatHexes`/`pushCandidates` above (plan.md §6).
 * That offer itself is applied by the CALLER (`BoardScene`'s
 * `promptAdvanceChoice`, mirrored headlessly in `engine/fuzzHarness.ts`),
 * not by any function in this file, so this predicate is exported for both
 * to filter candidates through before ever asking `chooseAdvance`.
 */
export function canUnitEnterHex(unit: Unit, hex: HexCoord): boolean {
  const terrain = MAP_TERRAIN.get(mapHexKey(hex.q, hex.r));
  if (terrain === undefined) return false; // off the map
  return canEnterTerrain(terrain, unitCategory(unit.typeId), unit.typeId === 'galeres');
}

/**
 * The subset of `candidates` (attackers eligible to advance into a hex a
 * combat just vacated) that could ACTUALLY occupy `vacatedHex`: still
 * alive, and — per `canUnitEnterHex` above — terrain its own category can
 * enter, which is not necessarily the same terrain the unit that vacated it
 * could stand on.
 *
 * Exported specifically so both callers of the post-combat "advance into
 * the vacated hex" offer can share ONE implementation of this filter rather
 * than each re-deriving it: `engine/fuzzHarness.ts`'s `processAdvanceOffer`
 * uses this (adversarial review of the Stage 2 fuzz harness found an
 * earlier version of that function only filtered by `!u.destroyed`, with no
 * terrain check, silently offering a cavalry/chariot attacker a marsh or
 * steep-flank hex it could never otherwise stand on). `BoardScene.ts`'s
 * `promptAdvanceChoice` had the IDENTICAL gap until plan.md §9.1; it now
 * calls this same function rather than carrying a separate, divergent
 * terrain check.
 */
export function eligibleAdvanceCandidates(candidates: readonly Unit[], vacatedHex: HexCoord): Unit[] {
  return candidates.filter((u) => !u.destroyed && canUnitEnterHex(u, vacatedHex));
}

/** True if a (normal) river runs along the hexside shared by two adjacent hexes. */
export function riverBetween(a: HexCoord, b: HexCoord): boolean {
  return RIVER_HEXSIDES.has(riverEdgeKey(a, b));
}

export function unitAt(state: GameState, hex: HexCoord): Unit | undefined {
  return state.units.find((u) => !u.destroyed && hexEquals(u.position, hex));
}

/**
 * Land combat: sums attack/defense across every attacker/defender, applies
 * a terrain modifier to the attacker's die roll, and looks up the CRT.
 *
 * With multiple defenders (possible in 'multi-defender' combat mode, or
 * naturally never in 'single-defender' mode where `defenders` is always
 * length 1), the terrain modifier uses the worst case for the attacker
 * across all defenders' hexes, and the river-crossing bonus applies if ANY
 * attacker crosses a river to reach ANY defender — both are the natural
 * generalization of the single-defender rule, favoring the defense the way
 * the original rule's single-hex lookup did.
 */
export interface LandAttackDetail {
  attackForce: number;
  /** What each attacker individually contributed to `attackForce`, keyed by
   * `Unit.id` — melee value or projectile value depending on how far it was
   * from the units it engaged (see `attackForceAgainst`). Carried on the
   * detail rather than left for a caller to re-derive because the combat log
   * has to show a per-unit number that adds up to `attackForce`, and by the
   * time it renders, `applyLandCombatResult` may already have destroyed some
   * of these units. Always has exactly one entry per attacker. */
  attackerForces: ReadonlyMap<string, number>;
  defenseForce: number;
  /** Force-ratio column label, e.g. "4-1" (see `RATIO_COLUMNS`). */
  ratioLabel: string;
  /** Index into `RATIO_COLUMNS` (and, equivalently, each row of
   * `data/combatTable.ts`'s `LAND_CRT`) that `ratioLabel` names — the exact
   * column `resolveLandCombat` looked up, so a result can be audited
   * against the printed table by column *and* row rather than just the
   * ratio label. */
  crtColumnIndex: number;
  /** Combined die modifier actually applied: `terrainOnlyModifier` plus
   * `RIVER_CROSSING.combatModifier` if `riverCrossingApplied`. */
  terrainModifier: number;
  /** The terrain component of `terrainModifier` alone, excluding the river
   * crossing bonus (a hexside property, not a terrain type — see
   * `riverBetween`). 0 when no defender's terrain contributed a bonus. */
  terrainOnlyModifier: number;
  /** Which terrain type contributed `terrainOnlyModifier` — the worst-case
   * defender hex per this function's own doc comment above — or `null` if
   * `terrainOnlyModifier` is 0 (plain terrain, or a conditional bonus like
   * plateau/steep-flank that didn't trigger because no attacker was below). */
  terrainModifierSource: TerrainType | null;
  /** The specific defender hex `terrainModifierSource` was read from, paired
   * with it so a multi-defender combat's modifier can be traced to exactly
   * one hex rather than just a terrain type. `null` iff `terrainModifierSource`
   * is `null`. */
  terrainModifierSourceHex: HexCoord | null;
  /** Whether the river-crossing bonus (`RIVER_CROSSING.combatModifier`)
   * contributed to `terrainModifier` — true if any attacker crossed a river
   * hexside to reach any defender. */
  riverCrossingApplied: boolean;
  rawDieRoll: number;
  /** `rawDieRoll + terrainModifier`, before the [1,6] clamp the CRT applies. */
  modifiedDieRoll: number;
  result: CombatResult;
}

/**
 * The force ONE attacker contributes to a combat against `defenders` — its
 * melee value when it is fighting at contact, its projectile value when it
 * is shooting.
 *
 * INTERPRETATION. The counter format is `attack (rangedAttack) range /
 * defense movement`, and the rulebook says of the parenthesized number: "le
 * chiffre entre parenthèses correspond à la valeur d'attaque par projectiles
 * (flèches des archers, par exemple). Toutes les unités qui ont une valeur
 * nulle en force d'attaque par projectiles sont obligées de combattre au
 * contact" (`docs/research/05-rules-french-original.md:78-82`). It is
 * explicitly an *attack value*, so a volley resolves on it. The combat rules
 * themselves never restate this — they say only "on additionne les points
 * d'attaque des unités offensives" (`:199-200`) without saying which of the
 * two numbers a shooter contributes — so reading "points d'attaque" as "the
 * attack value appropriate to how this unit is engaging" is a reading, not a
 * quotation. Everything else in the roster is unaffected: only `archers`,
 * `fantassins-archers`, `triremes` and `quintiremes` have a non-zero
 * `rangedAttack` at all.
 *
 * Three sub-questions the rulebook does not answer directly, and the
 * readings taken here:
 *
 * 1. **Which value a melee-capable shooter uses at distance 1.** Of the
 *    archer-infantry the rules say they shoot at two hexes "qui ont en outre
 *    la possibilité de combattre au contact" (`:261-263`) — fighting at
 *    contact is an *additional* ability, i.e. the ordinary melee attack, so
 *    contact takes the melee value. This mirrors `checkRangedEligibility`'s
 *    own precedence, which resolves distance 1 through the melee branch
 *    before it ever looks at `range`. It is also, on the shipped roster, a
 *    distinction without a difference: `fantassins-archers` are 2 and 2.
 * 2. **Whether a shooter may join a combined attack.** Yes: "plusieurs
 *    unités d'une même armée peuvent attaquer une seule unité adverse [...]
 *    Il faut cependant qu'elles remplissent les conditions de proximité
 *    inhérentes à leurs types d'armes. Attention, les archers notamment ne
 *    peuvent combattre qu'à exactement 2 cases de distance" (`:192-198`) —
 *    the rule names archers specifically as an example of a per-attacker
 *    proximity condition inside a combined attack, so each attacker
 *    contributes the value matching *its own* engagement distance. That is
 *    what the per-attacker loop below does.
 * 3. **Whether a ranged result behaves like a melee one.** There is one
 *    combat-results table and no ranged variant of it, so an AR/DR/EX from a
 *    volley resolves exactly as it does at contact — including the defender
 *    retreating one hex, and including the attacker's option to advance into
 *    the vacated hex "sans tenir compte des limites de déplacement qui lui
 *    sont propres" (`:250-256`). Unchanged from before this function
 *    existed.
 *
 * With several defenders (multi-defender mode), an attacker is taken to be
 * fighting at contact if ANY defender in the group is adjacent to it, and
 * shooting if any sits at exactly its range — checked in that order, so a
 * unit that could do either against different members of one group fights
 * the way it would against the nearest of them.
 *
 * The final fallback is deliberately `currentAttack` rather than 0: this is
 * only reached for an attacker that satisfies neither condition, i.e. one
 * that was never eligible to be in this combat at all
 * (`checkRangedEligibility` gates that), so it is a "caller built an illegal
 * group" case and should not silently look like a legal attack at zero
 * force — the exact failure this whole function exists to fix.
 */
export function attackForceAgainst(attacker: Unit, defenders: readonly Unit[]): number {
  const t = unitType(attacker);
  const atDistance = (d: number) => defenders.some((u) => hexDistance(attacker.position, u.position) === d);
  if (t.meleeCapable && atDistance(1)) return currentAttack(attacker);
  if (t.rangedAttack > 0 && atDistance(t.range)) return currentRangedAttack(attacker);
  return currentAttack(attacker);
}

function computeLandAttackDetail(
  attackers: Unit[],
  defenders: Unit[],
  rawDieRoll: number,
): LandAttackDetail {
  const attackerForces = new Map<string, number>(
    attackers.map((u) => [u.id, attackForceAgainst(u, defenders)]),
  );
  const attackForce = attackers.reduce((sum, u) => sum + attackerForces.get(u.id)!, 0);
  const defenseForce = defenders.reduce((sum, u) => sum + currentDefense(u), 0);

  let terrainOnlyModifier = 0;
  let terrainModifierSource: TerrainType | null = null;
  let terrainModifierSourceHex: HexCoord | null = null;
  let acrossRiver = false;
  for (const defender of defenders) {
    const defenderTerrain = terrainAt(defender.position);
    const terrain = TERRAIN_EFFECTS[defenderTerrain];
    // "+2 if the attackers come from below" is approximated as: apply the
    // conditional bonus whenever any attacker's own hex is not the same
    // elevated terrain type as this defender's (i.e. attacking up onto it).
    let defenderModifier = terrain.combatModifier;
    if (terrain.conditionalOnAttackingFromBelow) {
      const attackingFromBelow = attackers.some((a) => terrainAt(a.position) !== defenderTerrain);
      defenderModifier = attackingFromBelow ? terrain.combatModifier : 0;
    }
    if (defenderModifier > terrainOnlyModifier) {
      terrainOnlyModifier = defenderModifier;
      terrainModifierSource = defenderTerrain;
      terrainModifierSourceHex = defender.position;
    }
    if (attackers.some((a) => riverBetween(a.position, defender.position))) acrossRiver = true;
  }
  const modifier = terrainOnlyModifier + (acrossRiver ? RIVER_CROSSING.combatModifier : 0);

  const modifiedDieRoll = rawDieRoll + modifier;
  const result = resolveLandCombat(attackForce, defenseForce, modifiedDieRoll);
  const crtColumnIndex = ratioToColumnIndex(attackForce, defenseForce);
  const ratioLabel = RATIO_COLUMNS[crtColumnIndex]!;

  return {
    attackForce,
    attackerForces,
    defenseForce,
    ratioLabel,
    crtColumnIndex,
    terrainModifier: modifier,
    terrainOnlyModifier,
    terrainModifierSource,
    terrainModifierSourceHex,
    riverCrossingApplied: acrossRiver,
    rawDieRoll,
    modifiedDieRoll,
    result,
  };
}

/**
 * Land combat: sums attack/defense across every attacker/defender, applies
 * a terrain modifier to the attacker's die roll, and looks up the CRT.
 *
 * With multiple defenders (possible in 'multi-defender' combat mode, or
 * naturally never in 'single-defender' mode where `defenders` is always
 * length 1), the terrain modifier uses the worst case for the attacker
 * across all defenders' hexes, and the river-crossing bonus applies if ANY
 * attacker crosses a river to reach ANY defender — both are the natural
 * generalization of the single-defender rule, favoring the defense the way
 * the original rule's single-hex lookup did.
 */
export function resolveLandAttack(
  attackers: Unit[],
  defenders: Unit[],
  rawDieRoll: number,
): CombatResult {
  return computeLandAttackDetail(attackers, defenders, rawDieRoll).result;
}

/** Same computation as `resolveLandAttack`, but returns the full breakdown
 * (force totals, ratio, terrain modifier, die roll) for UI display. */
export function describeLandAttack(
  attackers: Unit[],
  defenders: Unit[],
  rawDieRoll: number,
): LandAttackDetail {
  return computeLandAttackDetail(attackers, defenders, rawDieRoll);
}

/**
 * Phalanxes' long lances (5-7m) make them unapproachable by horse: "la
 * cavalerie ne peut effectuer de charge ou plus simplement d'attaques contre
 * ces unités" (`docs/research/05-rules-french-original.md`) — cavalry may
 * never attack a phalanx, whether by charge or by an ordinary attack. This
 * is the ONLY unit-vs-unit targeting restriction beyond range/adjacency, so
 * it's kept as its own small predicate rather than folded into
 * `checkRangedEligibility` (which only knows the attacker and a distance,
 * not the defender's type).
 */
export function cavalryMayAttack(attacker: Unit, defender: Unit): boolean {
  if (unitCategory(attacker.typeId) !== 'cavalry') return true;
  return unitType(defender).id !== 'phalanges';
}

/**
 * Every enemy unit `attacker` could individually reach on its own (right
 * range for archers, adjacency for melee, domain rules for naval),
 * excluding anything already resolved against this combat phase ("a unit
 * may only be attacked once per combat phase") and, for cavalry, phalanx
 * targets (see `cavalryMayAttack`).
 */
export function validTargets(state: GameState, attacker: Unit): Unit[] {
  const t = unitType(attacker);
  return state.units.filter((u) => {
    if (u.destroyed || u.owner === attacker.owner || u.defendedThisPhase) return false;
    if (!cavalryMayAttack(attacker, u)) return false;
    const dist = hexDistance(attacker.position, u.position);
    // Ramming is a movement-phase event (see `navalMovement.findRammingContacts`) —
    // by the time the Combat phase runs, the only naval option left is boarding.
    if (t.domain === 'naval') return dist === 1 && canBoard(attacker, u);
    return checkRangedEligibility(attacker, dist).canAttack;
  });
}

/**
 * Whether two adjacent ships may fight by boarding: "l'abordage nécessite
 * que les vaisseaux se présentent parallèlement sur des hexagones
 * contigus" — the ships' facings must run along the same line of travel
 * (identical or exactly opposite), as opposed to one ship's bow pointing
 * directly at the other, which is a ramming angle instead.
 */
export function canBoard(attacker: Unit, defender: Unit): boolean {
  return hexDistance(attacker.position, defender.position) === 1 && areFacingsParallel(attacker.facing, defender.facing);
}

/**
 * Targets every unit in `group` can ALL individually reach — the
 * eligibility rule for 'single-defender' combat mode, where every attacker
 * must satisfy its own range requirement against the one shared target.
 */
export function commonValidTargets(state: GameState, group: Unit[]): Unit[] {
  if (group.length === 0) return [];
  let common = validTargets(state, group[0]!);
  for (const unit of group.slice(1)) {
    const targets = validTargets(state, unit);
    common = common.filter((u) => targets.some((t) => t.id === u.id));
  }
  return common;
}

/**
 * Targets reachable by AT LEAST ONE unit in `group` — the eligibility rule
 * for 'multi-defender' combat mode, where the combined attacking force can
 * spread across several defending units as long as each attacker can reach
 * at least one of them.
 */
export function unionValidTargets(state: GameState, group: Unit[]): Unit[] {
  const seen = new Map<string, Unit>();
  for (const unit of group) {
    for (const target of validTargets(state, unit)) seen.set(target.id, target);
  }
  return Array.from(seen.values());
}

/** Whether `candidate` may join the attacking side of a combat currently
 * targeting `defenderGroup`, per the join rule for `mode`. An empty
 * defender group (nothing targeted yet) always allows joining.
 *
 * The phalanx restriction is checked against the WHOLE `defenderGroup` here,
 * not just via `validTargets`/`unionValidTargets` below: in 'multi-defender'
 * mode, `unionValidTargets` only asks whether *some* attacker can reach a
 * given defender, which a phalanx can satisfy through a non-cavalry
 * groupmate even while a cavalry unit sits elsewhere in the same attack
 * group — that cavalry unit would then get credit (and, if charging, a
 * doubled attack value) for a combat the rulebook forbids it from joining at
 * all. So this explicit check rejects a cavalry candidate whenever ANY
 * current defender is a phalanx, regardless of what the rest of the group
 * could otherwise reach. */
export function attackerCanJoin(
  state: GameState,
  candidate: Unit,
  defenderGroup: Unit[],
  mode: CombatMode,
): boolean {
  if (defenderGroup.some((d) => !cavalryMayAttack(candidate, d))) return false;
  if (defenderGroup.length === 0) return true;
  const targets = validTargets(state, candidate);
  if (mode === 'single-defender') {
    return defenderGroup.every((d) => targets.some((t) => t.id === d.id));
  }
  return defenderGroup.some((d) => targets.some((t) => t.id === d.id));
}

/** Whether `candidate` may join the defending side of a combat currently
 * being attacked by `attackGroup`, per the join rule for `mode`.
 *
 * Mirrors `attackerCanJoin`'s explicit phalanx check, for the same reason:
 * `unionValidTargets` alone would let a phalanx join as a valid
 * 'multi-defender' target on the strength of a non-cavalry attacker already
 * in `attackGroup`, even though a cavalry unit sits in that same group and
 * may never attack it. Reject the join outright if any current attacker
 * can't legally attack `candidate`. */
export function defenderCanJoin(
  state: GameState,
  candidate: Unit,
  attackGroup: Unit[],
  mode: CombatMode,
): boolean {
  if (attackGroup.some((a) => !cavalryMayAttack(a, candidate))) return false;
  if (mode === 'single-defender') {
    return commonValidTargets(state, attackGroup).some((u) => u.id === candidate.id);
  }
  return unionValidTargets(state, attackGroup).some((u) => u.id === candidate.id);
}

export interface RangedCheck {
  canAttack: boolean;
  reason?: string;
}

/** Ranged units may only fire at EXACTLY their listed range; melee units need adjacency. */
export function checkRangedEligibility(attacker: Unit, distance: number): RangedCheck {
  const t = unitType(attacker);
  if (distance === 1) {
    if (t.meleeCapable) return { canAttack: true };
    return { canAttack: false, reason: `${t.name} cannot fight in melee` };
  }
  if (t.rangedAttack > 0 && distance === t.range) {
    return { canAttack: true };
  }
  return { canAttack: false, reason: `${t.name} can only fire at exactly ${t.range} hexes` };
}

/**
 * Whether a drifting elephant may enter `hex` at all: on the map, and
 * within the "land zone" (not sea-like, not coastal fringe). Per the
 * rulebook ("lorsqu'il sort du plateau de jeu ou de la zone terrestre, il
 * est éliminé"), failing this eliminates the elephant on the spot.
 */
export function canElephantEnterHex(hex: HexCoord): boolean {
  const terrain = MAP_TERRAIN.get(mapHexKey(hex.q, hex.r));
  if (terrain === undefined) return false; // off the map
  return terrain !== 'coast' && !isSeaLike(terrain);
}

/**
 * The 6 hexes adjacent to `unit` that it may legally retreat into: on the
 * map, terrain its category can actually enter, unoccupied (by either side —
 * no stacking), and not under an enemy zone of control ("a retreating unit
 * may never be forced to retreat into an enemy ZOC hex"). The owning player
 * picks among these.
 *
 * INTERPRETATION — the terrain check was added after the Stage 2 fuzz
 * harness (plan.md §6) caught cavalry and chariots retreating onto
 * steep-flank terrain, and a chariot onto marsh. The rulebook's own N.B. on
 * terrain restrictions ("Chars et cavaleries sont interdits sur les flancs
 * abrupts ; chars, cavaleries et éléphants ne peuvent accéder aux marais. La
 * mer n'est pas accessible aux armées de terre" — `docs/research/05-rules-french-original.md:186-188`)
 * sits in the MOVEMENT/terrain-cost section, not the retreat rules, so
 * applying it to a forced retreat is a reading, not a literal restatement —
 * but it's the reading the rulebook's own later paragraph on retreat
 * supports: sea is named as the LEADING example of "impossibilité de
 * reculer" ⇒ elimination ("Une unité qui se trouve dans l'impossibilité de
 * reculer, soit parce qu'elle est en bordure de mer, soit parce qu'elle est
 * entourée de zones de contrôle ennemies, est tout simplement retirée du
 * jeu" — `:239-241`). If sea (one terrain-accessibility rule from the same
 * N.B.) already blocks retreat and eliminates on failure, steep-flank/marsh
 * (the other two rules in that same sentence) reads as intended to as well —
 * treating sea specially while letting cavalry retreat onto ground it could
 * never otherwise stand on would be the inconsistent reading, and is what
 * this codebase did before this fix.
 *
 * This can genuinely eliminate a unit with no enemy adjacent and no ZOC
 * involved at all: (4,9) on the shipped map is 'plateau' ringed by 6
 * 'steep-flank' hexes (see `combat.test.ts`'s "(4,9) on the shipped map"
 * tests), so cavalry retreating from there has nowhere to go and is
 * destroyed by `applyLandCombatResult`'s `forceRetreat`, below.
 *
 * `canEnterTerrain`'s `isGalley` parameter is left at its default (`false`):
 * a ship is never in `pendingRetreats`/`pendingDrifts` in the first place
 * (see `applyLandCombatResult` — only land combat forces a retreat), so
 * this path never needs the land/naval domain split that flag exists for.
 */
export function legalRetreatHexes(state: GameState, unit: Unit): HexCoord[] {
  const enemyZoc = hexesUnderZoc(state, unit.owner);
  const category = unitCategory(unit.typeId);
  return DIRECTIONS.map((d) => hexAdd(unit.position, d)).filter((hex) => {
    const terrain = MAP_TERRAIN.get(mapHexKey(hex.q, hex.r));
    if (terrain === undefined) return false; // off the map
    if (!canEnterTerrain(terrain, category)) return false;
    if (unitAt(state, hex)) return false; // occupied, friend or foe
    if (enemyZoc.has(mapHexKey(hex.q, hex.r))) return false;
    return true;
  });
}

/**
 * Friendly neighbors of `unit` that could make room for it by retreating
 * themselves (directly, or — see the cascade note below — by pushing
 * further down the chain) — the rulebook's exception to
 * elimination-on-no-retreat: "a unit forced to retreat with nowhere legal
 * to go is simply eliminated — unless it's surrounded by friendly units, in
 * which case it pushes one of them aside and takes its place."
 *
 * INTERPRETATION (plan.md §12.2) — the rulebook's exact wording
 * (`docs/research/05-rules-french-original.md:239-243`) is "Une unité qui se
 * trouve dans l'impossibilité de reculer... est tout simplement retirée du
 * jeu. Le seul cas fait exception à la règle, lorsque cette unité est
 * **entourée** d'unités amies." Read maximally literally, "entourée" (fully
 * surrounded) would require all SIX neighbors to be friendly before any push
 * is even considered — this function used to implement exactly that,
 * returning `[]` (falling through to elimination) the moment even one
 * neighbor was merely EMPTY-but-unusable (an enemy ZOC hex, or terrain the
 * unit's own category can't enter), not friendly-occupied at all.
 *
 * That strict reading is rejected here in favor of the permissive one: a
 * push is offered whenever retreat is impossible and AT LEAST ONE adjacent
 * friendly unit can make room. Three reasons, per this repo's
 * ambiguous-rulebook-gets-a-comment convention (see `data/navalRamming.ts`):
 *   1. The strict reading makes the exception nearly unreachable — it
 *      demands six units committed to surrounding one of your own. The
 *      Stage 2 fuzz harness measured `pushTarget: 0` across 100 games of
 *      real (if random) play before this change. A rule that essentially
 *      never fires is evidence of a misreading, not evidence the rule is
 *      rarely relevant. Caveat, found during review of this very fix: the
 *      SAME 100-game default soak (`fuzzHarness.test.ts`'s
 *      `pushesResolved` counter) still reads 0 even AFTER this widening —
 *      that army is simply too small and spread out to ever box a unit in
 *      tightly enough, not evidence the widening was unnecessary. A
 *      separate, purpose-built `buildPushScenarioGameState` scenario
 *      (same file) reliably reaches several pushes within 30 seeds,
 *      confirming the widened path is real and reachable; it just isn't
 *      the DEFAULT army's job to prove that on its own.
 *   2. The general elimination rule's stated causes ("soit parce qu'elle
 *      est en bordure de mer, soit parce qu'elle est entourée de zones de
 *      contrôle ennemies") are introduced with "soit... soit..." —
 *      illustrative examples, not an exhaustive enumeration — so a MIXED
 *      blocker set (some friendly, some ZOC/terrain-blocked-but-empty)
 *      doesn't obviously fall outside the exception just because it isn't
 *      one of the two named causes.
 *   3. The exception's evident purpose is that a unit shouldn't die merely
 *      because its OWN side is in the way. That purpose holds whether one
 *      neighbor or six are friendly — a unit with five friendlies and one
 *      ZOC-blocked empty hex is just as much "blocked by its own side" as
 *      one with six friendlies.
 * So: an off-map, enemy-occupied, or empty-but-unusable neighbor is simply
 * not a candidate (skipped), but no longer voids every OTHER neighbor's
 * candidacy the way it did under the strict reading.
 *
 * INTERPRETATION, THE CASCADE (plan.md §12.3) — the rulebook's sentence
 * granting the exception stops at "elle pousse une de ses pièces et prend
 * sa place" (`:242-243`, "it pushes one of its pieces and takes its
 * place") and says NOTHING about what happens if that pushed piece has
 * nowhere to go either. Chaining the same exception down to that piece —
 * rather than falling back to elimination the moment the SECOND unit in
 * the line also can't retreat directly — is therefore its own invented
 * extension, not a literal restatement, exactly as much an interpretive
 * choice as the widening above (both read the text's silence as "the
 * exception's purpose extends however far it needs to," not as "the
 * exception is only ever one level deep"). Recorded here for the same
 * reason as the widening: rejecting it (stopping the chain at depth 1 and
 * eliminating the second-in-line unit instead) would be an equally
 * defensible, and arguably more literal, alternative reading — this
 * codebase chose to chain.
 *
 * Mechanically: a friendly neighbor that itself has no
 * direct retreat may still make room by pushing one of ITS OWN friendly
 * neighbors in turn, and so on. So a candidate `f` qualifies if it has a
 * direct legal retreat (`legalRetreatHexes`), OR if IT can reach (through a
 * chain of further friendly pushes) some other unit that does. `visited`
 * carries every unit already committed to the current chain (ancestors, NOT
 * including `unit` itself — this function adds `unit` before computing)
 * because a cycle (A pushes B, B pushes C, C's only route is back to A, who
 * hasn't moved yet) must not be offered as an exit: a unit already in the
 * chain is excluded from the whole computation below, not just from being
 * re-offered as an immediate candidate. Callers resolving an ACTUAL cascade
 * (not just checking whether one exists) must thread the SAME growing
 * `visited` set through their own recursion (see `completePush`'s doc
 * comment, and `BoardScene.beginUnitRetreatChoice` / `fuzzHarness.
 * resolveUnitRetreat`), otherwise a unit still mid-chain (not yet moved)
 * could be independently re-offered as if it were an ordinary bystander.
 *
 * Only neighbors that themselves have somewhere to go (directly or via
 * cascade) AND whose hex `unit` itself could actually enter are offered:
 * "pushed aside" means that unit actually retreats to make room, not
 * swapping places — a neighbor with no room of its own (anywhere down its
 * own chain) can't make room for anyone else either, and `unit` taking that
 * neighbor's hex is only a real option if its own category can enter that
 * terrain (found by the Stage 2 fuzz harness, plan.md §6: a
 * cavalry/chariot/elephant unit boxed in by friendlies standing on
 * steep-flank/marsh terrain — legal for THEM, not for the boxed-in unit's
 * category — could otherwise be pushed onto terrain `legalRetreatHexes`
 * would never offer it directly). This terrain check applies at EVERY link
 * of the chain, not just the first: each pusher must be able to occupy the
 * hex it's about to inherit, checked against whichever unit is doing the
 * pushing at that link — see the fixpoint's terrain check below, applied
 * per-edge rather than just at the top level.
 *
 * NOT checked here, unlike `legalRetreatHexes`: whether the inherited hex
 * sits under enemy ZOC. `legalRetreatHexes` refuses to send a normally
 * retreating unit into an empty ZOC hex, but a hex a friendly unit is
 * ALREADY standing on can perfectly well be under enemy ZOC too (ZOC
 * doesn't prevent occupying a hex, only entering one uninvited) — the
 * rulebook's own push sentence (`:242-243`) says nothing about ZOC at all,
 * so applying `legalRetreatHexes`'s exclusion here would be ANOTHER
 * invented extension, not obviously more or less licensed than leaving it
 * out. Pre-existing before this change (the single-level version never
 * checked it either) but worth flagging explicitly now that the widened,
 * cascading version makes a mixed friendly/ZOC-blocked-empty neighbor set
 * the headline scenario rather than an edge case: a unit could in principle
 * be pushed into a hex under enemy ZOC that it could never have retreated
 * into directly. Left as-is rather than silently "fixed" one way or the
 * other — a real design decision for whoever picks this up next, not this
 * comment's call to make unilaterally.
 *
 * PERFORMANCE — this used to be a plain recursive DFS re-deriving each
 * candidate's viability by enumerating simple paths through the friendly-
 * unit graph, with no memoization. That's exponential in the size of a
 * densely packed formation (a single query against a ~20-unit encircled
 * pocket measured minutes of wall-clock time, on the browser's main
 * thread), which is exactly the scenario this feature exists to serve — a
 * unit surrounded by its own side. Since the DFS's cycle guard only ever
 * excludes the FIXED set `visited ∪ {unit}` (identically at every level, not
 * a per-branch-growing set — a candidate's own recursive exploration adds to
 * that set only along its own path, never affecting sibling candidates), "a
 * simple path to some direct-retreat unit exists, avoiding `visited ∪
 * {unit}`" is exactly equivalent to plain graph reachability in the
 * friendly-unit graph with `visited ∪ {unit}` removed (any walk that reaches
 * a target can be reduced to a simple path reaching the same target by
 * cutting out its cycles, without ever touching an excluded vertex — a
 * standard fact, not particular to this graph). That reachability is
 * computable by a single fixpoint below in O(units × 6) work total, in place
 * of the DFS's unbounded path enumeration — a genuine algorithmic
 * replacement, not a cache bolted onto the same exponential search.
 */
export function pushCandidates(state: GameState, unit: Unit, visited: ReadonlySet<string> = new Set()): Unit[] {
  const excluded = new Set(visited);
  excluded.add(unit.id);

  // Every OTHER friendly unit still eligible to be part of this chain.
  const pool = state.units.filter((u) => !u.destroyed && u.owner === unit.owner && !excluded.has(u.id));

  // Fixpoint: start from units with a direct legal retreat, then repeatedly
  // absorb any pool unit adjacent to an already-"can make room" friendly
  // whose hex it could itself enter — exactly the recursive filter's own
  // termination condition, computed as a flood-fill instead of a per-call
  // DFS.
  const canMakeRoom = new Set<string>(pool.filter((u) => legalRetreatHexes(state, u).length > 0).map((u) => u.id));
  for (let changed = true; changed; ) {
    changed = false;
    for (const u of pool) {
      if (canMakeRoom.has(u.id)) continue;
      const uCategory = unitCategory(u.typeId);
      for (const d of DIRECTIONS) {
        const neighbor = unitAt(state, hexAdd(u.position, d));
        if (
          neighbor &&
          neighbor.owner === u.owner &&
          !excluded.has(neighbor.id) &&
          canMakeRoom.has(neighbor.id) &&
          canEnterTerrain(terrainAt(neighbor.position), uCategory)
        ) {
          canMakeRoom.add(u.id);
          changed = true;
          break;
        }
      }
    }
  }

  // `unit`'s own direct neighbors, filtered down to the friendly ones that
  // both qualify (per the fixpoint above) and whose hex `unit` itself could
  // enter. An off-map neighbor never has a unit on it in a valid game state
  // (see `assertInvariants` in engine/fuzzHarness.ts), so `unitAt` returning
  // `undefined` there already excludes it without a separate map-bounds
  // check — the same widened reading as before: a neighbor that isn't
  // friendly-occupied (off-map, enemy-occupied, or empty) is simply not a
  // candidate, but no longer voids every OTHER neighbor's candidacy.
  const category = unitCategory(unit.typeId);
  const candidates: Unit[] = [];
  for (const d of DIRECTIONS) {
    const f = unitAt(state, hexAdd(unit.position, d));
    if (!f || f.owner !== unit.owner || excluded.has(f.id)) continue;
    if (!canEnterTerrain(terrainAt(f.position), category)) continue;
    if (canMakeRoom.has(f.id)) candidates.push(f);
  }
  return candidates;
}

/** Moves a retreating unit to a player-chosen hex from `legalRetreatHexes`. */
export function retreatUnitTo(unit: Unit, hex: HexCoord): void {
  unit.position = hex;
}

/**
 * Resolves one LINK of the "surrounded by friendly units" cascade (see
 * `pushCandidates`): `unit` takes over `vacatedHex`, the hex `pushed`
 * occupied immediately before ITS OWN retreat was resolved.
 *
 * CONTRACT CHANGE from the single-level version — `pushed`'s own move is no
 * longer this function's job. With a cascade, `pushed` may itself have no
 * direct retreat and have to push a THIRD unit in turn (`legalRetreatHexes`
 * / `pushCandidates` again, recursively); resolving that is the caller's
 * job (see `BoardScene.beginUnitRetreatChoice` / `fuzzHarness.
 * resolveUnitRetreat`), driven by the SAME per-unit retreat-or-push decision
 * `unit` itself just went through. By the time `completePush` is called,
 * `pushed`'s resolution (however many further links it took) is already
 * complete and `pushed.position` no longer reflects the hex `unit` is
 * entitled to — so the caller must capture `vacatedHex = {...pushed.position}`
 * BEFORE recursing into `pushed`'s own resolution, and pass that captured
 * value here, not `pushed.position` read after the fact.
 */
export function completePush(unit: Unit, vacatedHex: HexCoord): void {
  unit.position = vacatedHex;
}

export interface LandCombatOutcome {
  result: CombatResult;
  /** True on an 'EX' result with more than one attacking unit: the caller
   * must still ask the attacking player which of THEIR units to sacrifice
   * (see `exchangeSacrificeMeetsThreshold` / `applyExchangeSacrifice`)
   * before the combat is fully resolved. */
  requiresExchangeChoice: boolean;
  /** The defenders' total force — the threshold a chosen sacrifice must
   * meet or exceed. Meaningful whenever `result === 'EX'`. */
  requiredSacrificeForce: number;
  /** Elephants forced to retreat (AR/DR) never resolve here — the caller
   * must drive their "drift" step by step (roll a direction, walk it hex
   * by hex, resolve real combat against anything encountered), since a
   * unit it tramples into can itself need a player choice (or its own
   * drift) before the elephant can continue. See `canElephantEnterHex`. */
  pendingDrifts: Unit[];
  /** Non-elephant units forced to retreat (AR/DR) that still need the
   * owning player to pick a destination — see `legalRetreatHexes` /
   * `pushCandidates` and `retreatUnitTo` / `completePush`. Process these
   * one at a time: each choice can change what's legal for the next unit
   * in the list. A unit with no legal hex and no push option is eliminated
   * immediately here and does NOT appear in this list. */
  pendingRetreats: Unit[];
}

/**
 * Applies a resolved land-combat result to the units involved. Marks every
 * defender `defendedThisPhase` regardless of outcome (enforcing "a unit may
 * only be attacked once per combat phase").
 *
 * On 'EX' (Échange), per the rulebook ("les unités attaquées sont retirées
 * du jeu, ainsi que les unités attaquantes totalisant une force au moins
 * égale"): defenders are always destroyed, and the attacker must ALSO lose
 * enough of their own units to total at least the defenders' force. With
 * only one attacking unit there's no real choice, so it's destroyed here
 * directly; with more than one, this function stops short and reports
 * `requiresExchangeChoice: true` so the caller can let the attacking player
 * pick which units to sacrifice.
 */
export function applyLandCombatResult(
  state: GameState,
  attackers: Unit[],
  defenders: Unit[],
  result: CombatResult,
): LandCombatOutcome {
  for (const d of defenders) d.defendedThisPhase = true;
  const requiredSacrificeForce = defenders.reduce((sum, u) => sum + currentDefense(u), 0);
  const pendingDrifts: Unit[] = [];
  const pendingRetreats: Unit[] = [];

  const forceRetreat = (unit: Unit) => {
    if (unitType(unit).id === 'elephants') {
      pendingDrifts.push(unit);
      return;
    }
    if (legalRetreatHexes(state, unit).length > 0 || pushCandidates(state, unit).length > 0) {
      pendingRetreats.push(unit);
      return;
    }
    unit.destroyed = true; // no legal retreat hex, and not surrounded by friendlies either
  };

  switch (result) {
    case 'AE':
      for (const a of attackers) a.destroyed = true;
      break;
    case 'DE':
      for (const d of defenders) d.destroyed = true;
      break;
    case 'AR':
      for (const a of attackers) forceRetreat(a);
      break;
    case 'DR':
      for (const d of defenders) forceRetreat(d);
      break;
    case 'EX':
      for (const d of defenders) d.destroyed = true;
      if (attackers.length <= 1) {
        for (const a of attackers) a.destroyed = true;
        return { result, requiresExchangeChoice: false, requiredSacrificeForce, pendingDrifts, pendingRetreats };
      }
      return { result, requiresExchangeChoice: true, requiredSacrificeForce, pendingDrifts, pendingRetreats };
  }
  return { result, requiresExchangeChoice: false, requiredSacrificeForce, pendingDrifts, pendingRetreats };
}

/**
 * The force one attacking unit counts for toward an 'EX' sacrifice
 * threshold ("les unités attaquantes totalisant une force au moins égale") —
 * the better of its melee and projectile attack values.
 *
 * WHY NOT the exact per-combat contribution from `LandAttackDetail.
 * attackerForces`. That would be the pedantically correct number, but it
 * would have to be threaded through `PlayerAgent.chooseExchangeSacrifice`
 * and every agent implementing it, and **on the shipped roster the two are
 * identical for every unit that can legally be in a land attack group**:
 * `archers` are 0/2, `fantassins-archers` are 2/2, every other land type has
 * `rangedAttack: 0`, and the only types where the two values differ
 * (`triremes` 20/2, `quintiremes` 25/2) are naval and resolve by boarding,
 * never through the land CRT. `combat.test.ts` walks `UNIT_TYPES` to pin
 * that coincidence, so a future roster edit that breaks it fails loudly
 * rather than silently mis-pricing a sacrifice.
 *
 * Charging cavalry is covered: `currentAttack` already returns the doubled
 * value, which per the README counts normally toward this threshold.
 *
 * This is not cosmetic. Before the ranged-force fix (plan.md §15) an archer
 * counted 0 here AND 0 in the attack, so a two-archer volley that rolled an
 * 'EX' at 4:1 produced a threshold no subset of the attackers could ever
 * meet — `RandomAgent`/`HeuristicAgent` throw "CRT invariant violated" and
 * `BoardScene`'s prompt can never be satisfied, i.e. a wedged board.
 */
export function exchangeSacrificeForce(unit: Unit): number {
  return Math.max(currentAttack(unit), currentRangedAttack(unit));
}

/** Whether `selected` attacking units' combined attack value meets the
 * exchange-sacrifice threshold required on an 'EX' result. */
export function exchangeSacrificeMeetsThreshold(selected: Unit[], requiredForce: number): boolean {
  return selected.reduce((sum, u) => sum + exchangeSacrificeForce(u), 0) >= requiredForce;
}

export function applyExchangeSacrifice(selected: Unit[]): void {
  for (const u of selected) u.destroyed = true;
}

/** Zone of control: every land unit projects into its 6 neighbors, except
 * ships (no ZOC) and across river hexsides (a ZOC does not cross a river,
 * per the rules: "les zones de contrôle ne franchissent pas les rivières"). */
export function hexesUnderZoc(state: GameState, forOwner: number): Set<string> {
  const zocHexes = new Set<string>();
  for (const unit of state.units) {
    if (unit.destroyed || unit.owner === forOwner) continue;
    const t = unitType(unit);
    if (t.domain === 'naval') continue;
    for (const dir of DIRECTIONS) {
      const neighborHex = hexAdd(unit.position, dir);
      const terrain = MAP_TERRAIN.get(mapHexKey(neighborHex.q, neighborHex.r));
      if (terrain === undefined) continue; // off the map
      if (riverBetween(unit.position, neighborHex)) continue; // ZOC blocked by river
      zocHexes.add(mapHexKey(neighborHex.q, neighborHex.r));
    }
  }
  return zocHexes;
}

export function isRammingHit(attackerType: ShipTypeId, defenderType: ShipTypeId, dieRoll: number): boolean {
  return isRammingSuccessful(attackerType, defenderType, dieRoll);
}

export function resolveNavalBoarding(attackForce: number, defenseForce: number, dieRoll: number): BoardingResult {
  return resolveBoarding(attackForce, defenseForce, dieRoll);
}

/** A successful ram sinks the target ship outright ("la galère de
 * l'attaquant coule la quintirème"); a miss leaves both ships intact. */
export function applyRammingResult(defender: Unit, hit: boolean): void {
  defender.defendedThisPhase = true;
  if (hit) defender.destroyed = true;
}

/**
 * Applies a resolved boarding result: the losing side (if any — a blank/pink
 * cell means the engagement wasn't decisive) loses `equipmentLoss` equipment
 * points, each worth -5 attack/-5 defense; a ship whose equipment reaches
 * zero has nothing left to fight with and is removed from the game.
 */
export function applyBoardingResult(attacker: Unit, defender: Unit, result: BoardingResult): void {
  defender.defendedThisPhase = true;
  if (result.side === null || result.equipmentLoss <= 0) return;
  const victim = result.side === 'attacker' ? attacker : defender;
  victim.equipmentPoints = Math.max(0, (victim.equipmentPoints ?? 0) - result.equipmentLoss);
  if (victim.equipmentPoints <= 0) victim.destroyed = true;
}
