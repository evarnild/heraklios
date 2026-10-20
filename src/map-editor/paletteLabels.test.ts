import { describe, it, expect } from 'vitest';
import { PALETTE_LABELS } from './paletteLabels';
import { TERRAIN_LABELS, TERRAIN_ORDER } from '../ui/hexRender';

const ZONES = ['zone-anse-hypnos', 'zone-pointe-eole', 'zone-baie-argos', 'zone-cap-zenon'];

describe('palette and game terrain labels', () => {
  it('gives every terrain a non-empty label in both tables', () => {
    for (const terrain of TERRAIN_ORDER) {
      expect(TERRAIN_LABELS[terrain], terrain).toBeTruthy();
      expect(PALETTE_LABELS[terrain], terrain).toBeTruthy();
    }
  });

  it('reads the same in both tables for the four zones (place names)', () => {
    for (const zone of ZONES) {
      expect(TERRAIN_LABELS[zone]).toBe(PALETTE_LABELS[zone as keyof typeof PALETTE_LABELS]);
    }
  });

  it('keeps the editor palette French, entry for entry', () => {
    expect(PALETTE_LABELS).toEqual({
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
    });
  });

  it('translates the seven non-zone game labels', () => {
    for (const terrain of TERRAIN_ORDER.filter((t) => !ZONES.includes(t))) {
      expect(TERRAIN_LABELS[terrain], terrain).not.toBe(PALETTE_LABELS[terrain]);
    }
  });
});
