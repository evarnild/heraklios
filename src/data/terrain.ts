export type TerrainType =
  | 'plain'
  | 'river-wide'
  | 'steep-flank'
  | 'plateau'
  | 'marsh'
  | 'coast'
  | 'zone-anse-hypnos'
  | 'zone-pointe-eole'
  | 'zone-baie-argos'
  | 'zone-cap-zenon'
  | 'sea';

/** The four named-bay deployment zones, in case code needs to enumerate them. */
export const ZONE_TERRAINS: readonly TerrainType[] = [
  'zone-anse-hypnos',
  'zone-pointe-eole',
  'zone-baie-argos',
  'zone-cap-zenon',
];

/** True for every "open water away from the coast" terrain: the four named
 * deployment zones plus high seas. Mechanically identical — any ship may
 * enter, land units never can — they're kept as distinct enum values only so
 * the map editor can paint them separately and the game can tell which bay a
 * hex belongs to for naval deployment. */
export function isSeaLike(terrain: TerrainType): boolean {
  return terrain === 'sea' || ZONE_TERRAINS.includes(terrain);
}

export interface TerrainEffect {
  /** Movement points consumed to enter one hex of this terrain. */
  moveCost: number;
  /**
   * Combat modifier: points added to the attacker's die roll before the CRT
   * lookup, based on the terrain of the DEFENDER's hex. `conditional: true`
   * means the bonus only applies "if the attackers come from below"
   * (i.e. attacking from a lower-elevation adjacent hex); otherwise it's 0.
   */
  combatModifier: number;
  conditionalOnAttackingFromBelow: boolean;
  /** Unit domains that cannot enter this terrain at all. */
  forbiddenFor: ReadonlyArray<'chariot' | 'cavalry' | 'elephant' | 'land' | 'naval'>;
}

const SEA_EFFECT: TerrainEffect = {
  moveCost: 1,
  combatModifier: 0,
  conditionalOnAttackingFromBelow: false,
  forbiddenFor: ['land'],
};

export const TERRAIN_EFFECTS: Readonly<Record<TerrainType, TerrainEffect>> = {
  plain: {
    moveCost: 1,
    combatModifier: 0,
    conditionalOnAttackingFromBelow: false,
    forbiddenFor: [],
  },
  'river-wide': {
    moveCost: 3,
    combatModifier: 2,
    conditionalOnAttackingFromBelow: false,
    forbiddenFor: [],
  },
  'steep-flank': {
    moveCost: 3,
    combatModifier: 2,
    conditionalOnAttackingFromBelow: true,
    forbiddenFor: ['chariot', 'cavalry'],
  },
  plateau: {
    moveCost: 1,
    combatModifier: 2,
    conditionalOnAttackingFromBelow: true,
    forbiddenFor: [],
  },
  marsh: {
    moveCost: 2,
    combatModifier: 1,
    conditionalOnAttackingFromBelow: false,
    forbiddenFor: ['chariot', 'cavalry', 'elephant'],
  },
  coast: {
    moveCost: 1,
    combatModifier: 0,
    conditionalOnAttackingFromBelow: false,
    forbiddenFor: [],
  },
  'zone-anse-hypnos': SEA_EFFECT,
  'zone-pointe-eole': SEA_EFFECT,
  'zone-baie-argos': SEA_EFFECT,
  'zone-cap-zenon': SEA_EFFECT,
  sea: SEA_EFFECT,
};

/**
 * River crossing is a HEXSIDE property, not a terrain type: on the original
 * board the (normal) river winds along hex edges rather than filling hexes.
 * Crossing a normal river hexside costs extra movement, and attacking across
 * it gives the defender a bonus (added to the attacker's die roll, per the
 * rules' "rivière normale" line: move cost 2, combat modifier +1). Note
 * `river-wide` above is a distinct, wider river that DOES fill a hex.
 */
export const RIVER_CROSSING = {
  extraMoveCost: 1,
  combatModifier: 1,
} as const;

/**
 * Only galleys may enter the coastal fringe or wide rivers; all other ships
 * are restricted to open sea / the named deployment zones. Land armies
 * cannot enter any sea-like terrain.
 */
export function canEnterTerrain(
  terrain: TerrainType,
  unitCategory: 'chariot' | 'cavalry' | 'elephant' | 'land' | 'naval',
  isGalley = false,
): boolean {
  const effect = TERRAIN_EFFECTS[terrain];
  if (effect.forbiddenFor.includes(unitCategory)) return false;
  if (unitCategory === 'naval') {
    if (isSeaLike(terrain)) return true;
    if (terrain === 'coast' || terrain === 'river-wide') return isGalley;
    return false;
  }
  if (isSeaLike(terrain) || terrain === 'coast') return false;
  return true;
}
