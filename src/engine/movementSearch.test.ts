import { describe, it, expect } from 'vitest';
import snapshot from './movementSearch.snapshot.json';
import { searchSnapshot } from './movementCases';

// §66: the searches gained predecessor tracking; their returned maps must be
// exactly what they were. The snapshot was captured from the code before the
// change (commit "§66: pre-change snapshot of the movement searches").
describe('reachableHexes / reachableNavalStates are unchanged', () => {
  it('matches the pre-§66 fingerprints for every unit of every case', () => {
    const now = searchSnapshot();
    expect(Object.keys(now).length).toBeGreaterThan(100);
    expect(now).toEqual(snapshot);
  });
});
