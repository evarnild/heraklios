import { describe, it, expect } from 'vitest';
import { EditorState, offsetToAxial } from './editorState';
import { toMapTsSource, toSaveFile, fromSaveFile } from './serialize';

describe('toMapTsSource', () => {
  it('generates a MAP_TERRAIN entry for every hex with the right terrain', () => {
    const state = new EditorState(2, 2);
    const target = offsetToAxial(1, 0);
    state.setTerrain(target, 'plateau');
    const src = toMapTsSource(state);
    expect(src).toContain('export const MAP_TERRAIN');
    expect(src).toContain(`hexKey(${target.q}, ${target.r}), 'plateau'`);
    expect(src).toContain("export function riverEdgeKey");
  });

  it('includes a literal river-hexside key for a toggled edge', () => {
    const state = new EditorState(2, 2);
    const a = offsetToAxial(0, 0);
    const b = offsetToAxial(0, 1);
    state.toggleRiver(a, b);
    const src = toMapTsSource(state);
    const lo = a.q < b.q || (a.q === b.q && a.r <= b.r) ? a : b;
    const hi = lo === a ? b : a;
    expect(src).toContain(`'${lo.q},${lo.r}|${hi.q},${hi.r}'`);
  });
});

describe('save/load round-trip', () => {
  it('reproduces terrain and rivers after a save/load cycle', () => {
    const state = new EditorState(3, 3);
    state.setTerrain(offsetToAxial(0, 0), 'sea');
    state.setTerrain(offsetToAxial(2, 2), 'zone-cap-zenon');
    state.toggleRiver(offsetToAxial(1, 0), offsetToAxial(1, 1));

    const restored = fromSaveFile(toSaveFile(state));

    for (const hex of state.allHexes()) {
      expect(restored.getTerrain(hex)).toBe(state.getTerrain(hex));
    }
    expect(restored.hasRiver(offsetToAxial(1, 0), offsetToAxial(1, 1))).toBe(true);
  });
});
