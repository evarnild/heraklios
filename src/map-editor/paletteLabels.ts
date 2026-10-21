import type { TerrainType } from '../data/terrain';

/** French labels for the map editor's terrain palette. The editor stays
 *  French while the game has its own language switch (§34 B4, §35), so it has its own table
 *  rather than sharing the game's terrain table (`ui/i18n`). */
export const PALETTE_LABELS: Record<TerrainType, string> = {
  plain: 'Plaine',
  'river-wide': 'Rivière large',
  'steep-flank': 'Flancs abrupts',
  plateau: 'Plateaux',
  marsh: 'Marais',
  coast: 'Frange côtière',
  'zone-anse-hypnos': "Anse d'Hypnos",
  'zone-pointe-eole': "Pointe d'Eole",
  'zone-baie-argos': "Baie d'Argos",
  'zone-cap-zenon': 'Cap Zénon',
  sea: 'Pleine mer',
};
