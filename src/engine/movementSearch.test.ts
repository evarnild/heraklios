import { describe, it, expect } from 'vitest';
import snapshot from './movementSearch.snapshot.json';
import { movementCases, searchSnapshot } from './movementCases';
import { reachableHexes } from './movement';
import { reachableNavalHexes } from './navalMovement';
import { unitCategory } from './state';

// §66: the searches gained predecessor tracking; their returned maps must be
// exactly what they were. The snapshot was captured from the code before the
// change (commit "§66: pre-change snapshot of the movement searches").
describe('reachableHexes for a ship', () => {
  it('matches the naval search costs, hex for hex', () => {
    let ships = 0;
    for (const c of movementCases()) {
      for (const u of c.state.units) {
        if (u.destroyed || unitCategory(u.typeId) !== 'naval') continue;
        const naval = reachableNavalHexes(c.state, u);
        expect(reachableHexes(c.state, u)).toEqual(new Map([...naval].map(([k, v]) => [k, v.cost])));
        expect(naval.size).toBeGreaterThan(0);
        ships++;
      }
    }
    expect(ships).toBeGreaterThan(5);
  });
});

describe('reachableHexes / reachableNavalStates are unchanged', () => {
  it('matches the pre-§66 fingerprints for every unit of every case', () => {
    const now = searchSnapshot();
    expect(Object.keys(now).length).toBeGreaterThan(100);
    expect(now).toEqual(snapshot);
  });
});
