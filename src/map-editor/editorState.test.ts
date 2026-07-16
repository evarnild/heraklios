import { describe, it, expect } from 'vitest';
import { EditorState, offsetToAxial, axialToOffset } from './editorState';

describe('offsetToAxial / axialToOffset', () => {
  it('round-trips for a range of columns and rows', () => {
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 10; row++) {
        const axial = offsetToAxial(col, row);
        const back = axialToOffset(axial);
        expect(back).toEqual({ col, row });
      }
    }
  });
});

describe('EditorState', () => {
  it('initializes every hex in the cols x rows grid to plain', () => {
    const state = new EditorState(4, 3);
    const hexes = state.allHexes();
    expect(hexes).toHaveLength(12);
    for (const hex of hexes) {
      expect(state.getTerrain(hex)).toBe('plain');
    }
  });

  it('setTerrain only affects the targeted hex', () => {
    const state = new EditorState(3, 3);
    const target = offsetToAxial(1, 1);
    state.setTerrain(target, 'marsh');
    for (const hex of state.allHexes()) {
      if (hex.q === target.q && hex.r === target.r) {
        expect(state.getTerrain(hex)).toBe('marsh');
      } else {
        expect(state.getTerrain(hex)).toBe('plain');
      }
    }
  });

  it('ignores setTerrain calls outside the grid', () => {
    const state = new EditorState(2, 2);
    const outside = { q: 99, r: 99 };
    expect(() => state.setTerrain(outside, 'sea')).not.toThrow();
    expect(state.getTerrain(outside)).toBeUndefined();
  });

  it('toggles a river edge symmetrically', () => {
    const state = new EditorState(3, 3);
    const a = offsetToAxial(0, 0);
    const b = offsetToAxial(0, 1);
    expect(state.hasRiver(a, b)).toBe(false);
    state.toggleRiver(a, b);
    expect(state.hasRiver(a, b)).toBe(true);
    expect(state.hasRiver(b, a)).toBe(true); // symmetric
    state.toggleRiver(b, a); // toggling from the other side turns it back off
    expect(state.hasRiver(a, b)).toBe(false);
  });

  it('neighborsInGrid excludes hexes outside the grid', () => {
    const state = new EditorState(2, 2);
    const corner = offsetToAxial(0, 0);
    const neighborsInGrid = state.neighborsInGrid(corner);
    // a corner hex in a 2x2 grid has far fewer in-grid neighbors than the full 6
    expect(neighborsInGrid.length).toBeLessThan(6);
    for (const n of neighborsInGrid) {
      expect(state.hasHex(n)).toBe(true);
    }
  });
});
