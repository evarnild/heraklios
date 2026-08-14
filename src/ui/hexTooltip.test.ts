import { describe, it, expect } from 'vitest';
import { formatHexTooltip } from './hexTooltip';
import { MAP_TERRAIN } from '../data/map';

describe('formatHexTooltip', () => {
  it('shows the coordinate and terrain label for a real map hex', () => {
    // (4,9) is 'plateau' on the shipped map — see combat.test.ts's "(4,9) on
    // the shipped map" tests for the same fixed point.
    expect(formatHexTooltip({ q: 4, r: 9 })).toBe('(4, 9) — Plateaux');
  });

  it('reflects a different real hex\'s terrain, not a hardcoded label', () => {
    // Find a real 'plain' hex from the map data itself rather than assuming
    // a specific coordinate, so this test doesn't silently start asserting
    // nothing if the map is ever re-authored.
    const plainEntry = [...MAP_TERRAIN.entries()].find(([, terrain]) => terrain === 'plain');
    expect(plainEntry).toBeDefined();
    const [key] = plainEntry!;
    const [q, r] = key.split(',').map(Number);
    expect(formatHexTooltip({ q: q!, r: r! })).toBe(`(${q}, ${r}) — Plaine`);
  });

  it('falls back to the plain label for a hex with no MAP_TERRAIN entry', () => {
    // Not reachable through a real hover (every hex MapView makes
    // interactive comes from allHexes(), which is derived from MAP_TERRAIN's
    // own keys) but the fallback should still be deliberate and match the
    // default MapView.ts's own rendering loop uses for the same lookup.
    const offMap = { q: 9999, r: -9999 };
    expect(MAP_TERRAIN.get(`${offMap.q},${offMap.r}`)).toBeUndefined();
    expect(formatHexTooltip(offMap)).toBe('(9999, -9999) — Plaine');
  });
});
