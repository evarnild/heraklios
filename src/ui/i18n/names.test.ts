import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNIT_TYPES } from '../../data/units';
import { resetSession, session } from '../session';
import { PLAYER_COLOR_NAMES, TERRAIN_ORDER } from '../hexRender';
import { messagesFor, resetLanguageForTests, setLanguage, type Language } from './index';
import { colorName, countryNames, edgeName, phaseName, seatControlName, terrainName, unitName } from './names';

const ENGLISH_UNITS: Record<string, string> = {
  archers: 'Archers',
  fantassins: 'Infantry',
  'fantassins-archers': 'Infantry-archers',
  'fantassins-lourds': 'Heavy infantry',
  phalanges: 'Phalanxes',
  'cavalerie-legere': 'Light cavalry',
  'cavalerie-lourde': 'Heavy cavalry',
  elephants: 'Elephants',
  'chars-legers': 'Light chariots',
  'chars-lourds': 'Heavy chariots',
  galeres: 'Galleys',
  biremes: 'Biremes',
  triremes: 'Triremes',
  quintiremes: 'Quinqueremes',
};

const ZONES_EN = {
  'zone-anse-hypnos': 'Hypnos Cove',
  'zone-pointe-eole': 'Aeolus Point',
  'zone-baie-argos': 'Bay of Argos',
  'zone-cap-zenon': 'Cape Zeno',
};
const ZONES_FR = {
  'zone-anse-hypnos': "Anse d'Hypnos",
  'zone-pointe-eole': "Pointe d'Eole",
  'zone-baie-argos': "Baie d'Argos",
  'zone-cap-zenon': 'Cap Zénon',
};

describe('names', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetLanguageForTests();
  });

  it('names every unit type in both languages', () => {
    for (const lang of ['en', 'fr'] as Language[]) {
      const units = messagesFor(lang).units as Record<string, string>;
      for (const type of UNIT_TYPES) expect(units[type.id], `${lang} ${type.id}`).toBeTruthy();
      expect(Object.keys(units).sort()).toEqual(UNIT_TYPES.map((t) => t.id).sort());
    }
  });

  it('uses the spec’s English names and the rulebook’s French ones', () => {
    const en = messagesFor('en').units as Record<string, string>;
    const fr = messagesFor('fr').units as Record<string, string>;
    for (const type of UNIT_TYPES) {
      expect(en[type.id]).toBe(ENGLISH_UNITS[type.id]);
      expect(fr[type.id]).toBe(type.name);
    }
  });

  it('names the four zones as the spec says, and every terrain in both languages', () => {
    for (const [lang, zones] of [['en', ZONES_EN], ['fr', ZONES_FR]] as const) {
      const terrain = messagesFor(lang).terrain as Record<string, string>;
      for (const [id, name] of Object.entries(zones)) expect(terrain[id]).toBe(name);
      for (const t of TERRAIN_ORDER) expect(terrain[t], `${lang} ${t}`).toBeTruthy();
    }
  });

  it('gives resetSession each language’s country names', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    setLanguage('fr');
    resetSession(4);
    expect(session.playerNames).toEqual(['Athènes', 'Perse', 'Macédoine', 'Sparte']);
    setLanguage('en');
    resetSession(4);
    expect(session.playerNames).toEqual(['Athens', 'Persia', 'Macedon', 'Sparta']);
  });

  it('reads the current language', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    setLanguage('en');
    expect(unitName('fantassins')).toBe('Infantry');
    expect(terrainName('zone-cap-zenon')).toBe('Cape Zeno');
    expect(countryNames()[1]).toBe('Persia');
    setLanguage('fr');
    expect(unitName('fantassins')).toBe('Fantassins');
    expect(terrainName('zone-cap-zenon')).toBe('Cap Zénon');
    expect(unitName('no-such-unit')).toBe('no-such-unit');
  });

  it('words edges, phases and seats in the current language', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    setLanguage('en');
    expect([edgeName('W'), phaseName('movement'), seatControlName('ai-ev')]).toEqual(['W', 'movement', 'AI — hard']);
    setLanguage('fr');
    expect([edgeName('W'), phaseName('combat'), seatControlName('ai-lookahead')]).toEqual(['O', 'combat', 'IA — prudente']);
    expect(edgeName('X')).toBe('X');
  });

  it('keeps the colour words in the order of the counter colours', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    const english = ['yellow', 'red', 'blue', 'green'];
    expect(PLAYER_COLOR_NAMES).toEqual(english);
    setLanguage('en');
    expect(PLAYER_COLOR_NAMES.map((_, i) => colorName(i))).toEqual(english);
    setLanguage('fr');
    expect(PLAYER_COLOR_NAMES.map((_, i) => colorName(i))).toEqual(['jaune', 'rouge', 'bleu', 'vert']);
    expect(colorName(9)).toBe('?');
  });
});
