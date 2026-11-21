import { describe, it, expect } from 'vitest';
import { MAP_TERRAIN, hexKey as mapHexKey, type HexCoord } from '../data/map';
import { RIVER_CROSSING, TERRAIN_EFFECTS } from '../data/terrain';
import { applyAction } from './actions';
import { riverBetween } from './combat';
import { DIRECTIONS, hexAdd, hexDistance, hexKey } from './hex';
import { evaluateCharge, reachableHexes } from './movement';
import { movementCases } from './movementCases';
import { landMovePath, navalMovePath, navalStatePath } from './movePath';
import { findRammingContacts, reachableNavalHexes, reachableNavalStates } from './navalMovement';
import { createInitialState } from './turnManager';
import { unitCategory, type GameState, type Unit } from './state';

function stepCost(from: HexCoord, to: HexCoord): number {
  const terrain = MAP_TERRAIN.get(mapHexKey(to.q, to.r))!;
  return TERRAIN_EFFECTS[terrain].moveCost + (riverBetween(from, to) ? RIVER_CROSSING.extraMoveCost : 0);
}

function parse(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q: q!, r: r! };
}

/** Asserts the path walks adjacent hexes around enemies, ends at `to`, and costs `cost`. */
function expectWalk(state: GameState, unit: Unit, path: HexCoord[], to: string, cost: number): void {
  expect(path.length).toBeGreaterThan(0);
  let prev = unit.position;
  let sum = 0;
  for (const step of path) {
    expect(hexDistance(prev, step)).toBe(1);
    const occupant = state.units.find((u) => !u.destroyed && hexKey(u.position) === hexKey(step));
    if (occupant) expect(occupant.owner).toBe(unit.owner);
    sum += stepCost(prev, step);
    prev = step;
  }
  expect(hexKey(prev)).toBe(to);
  expect(sum).toBe(cost);
}

describe('landMovePath (AC1)', () => {
  it('walks adjacent hexes around enemies to every reachable hex, at the search cost', () => {
    let checked = 0;
    for (const c of movementCases()) {
      for (const unit of c.state.units) {
        if (unit.destroyed || unitCategory(unit.typeId) === 'naval') continue;
        for (const [key, cost] of reachableHexes(c.state, unit)) {
          const to = parse(key);
          if (evaluateCharge(c.state, unit, to) !== null) continue; // a charge has its own test
          expectWalk(c.state, unit, landMovePath(c.state, unit, to)!, key, cost);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('returns null for a hex the unit cannot reach', () => {
    const c = movementCases()[0]!;
    const unit = c.state.units[0]!;
    expect(landMovePath(c.state, unit, { q: 0, r: 0 })).toBeNull();
  });
});

function cavalryState(): { state: GameState; cav: Unit } {
  const state = createInitialState([], 'multi-defender');
  const base = { facing: 0, defendedThisPhase: false, charged: false, destroyed: false };
  const cav: Unit = { ...base, id: 'cav', owner: 0, typeId: 'cavalerie-legere', position: { q: 10, r: 1 }, movementLeft: 6 };
  const foe: Unit = { ...base, id: 'foe', owner: 1, typeId: 'fantassins', position: { q: 15, r: 1 }, movementLeft: 0 };
  state.units = [cav, foe];
  return { state, cav };
}

describe('landMovePath for a charge (AC1)', () => {
  it('(10,1) to (14,1) walks the 4-hex straight line, not the cheaper detour', () => {
    const { state, cav } = cavalryState();
    const to = { q: 14, r: 1 };
    expect(evaluateCharge(state, cav, to)).toBe(6);
    expect(reachableHexes(state, cav).get('14,1')).toBe(5);
    const path = landMovePath(state, cav, to)!;
    expect(path).toEqual([
      { q: 11, r: 1 },
      { q: 12, r: 1 },
      { q: 13, r: 1 },
      { q: 14, r: 1 },
    ]);
    let prev = cav.position;
    let sum = 0;
    for (const step of path) {
      sum += stepCost(prev, step);
      prev = step;
    }
    expect(sum).toBe(6);
  });
});

function navalCases(): Array<{ state: GameState; ship: Unit }> {
  const out: Array<{ state: GameState; ship: Unit }> = [];
  for (const c of movementCases()) {
    for (const ship of c.state.units) {
      if (!ship.destroyed && unitCategory(ship.typeId) === 'naval') out.push({ state: c.state, ship });
    }
  }
  return out;
}

function checkSteps(ship: Unit, path: Array<{ hex: HexCoord; facing: number }>): number {
  let hex = ship.position;
  let facing = ship.facing;
  let cost = 0;
  for (const step of path) {
    if (hexKey(step.hex) === hexKey(hex)) {
      expect([1, 5]).toContain((step.facing - facing + 6) % 6);
      cost += 1;
    } else {
      expect(step.facing).toBe(facing);
      expect(step.hex).toEqual(hexAdd(hex, DIRECTIONS[facing]!));
      cost += stepCost(hex, step.hex);
    }
    hex = step.hex;
    facing = step.facing;
  }
  return cost;
}

describe('navalMovePath (AC2)', () => {
  it('every reachable (hex, facing) state is a chain of single rotations and bow steps at the search cost', () => {
    let checked = 0;
    for (const { state, ship } of navalCases()) {
      for (const s of reachableNavalStates(state, ship).values()) {
        const path = navalStatePath(state, ship, s);
        const end = path[path.length - 1] ?? { hex: ship.position, facing: ship.facing };
        expect(hexKey(end.hex)).toBe(hexKey(s.hex));
        expect(end.facing).toBe(s.facing);
        expect(checkSteps(ship, path)).toBe(s.cost);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('ends where applyAction navalMove ends, with and without a pinned facing', () => {
    let checked = 0;
    for (const { state, ship } of navalCases()) {
      const targets = new Set<string>([...reachableNavalHexes(state, ship).keys()]);
      for (const c of findRammingContacts(state, ship)) targets.add(hexKey(c.hex));
      for (const key of targets) {
        const to = parse(key);
        for (const facing of [undefined, ship.facing]) {
          const clone = structuredClone(state);
          const mover = clone.units.find((u) => u.id === ship.id)!;
          let applied = false;
          try {
            applyAction(clone, { kind: 'navalMove', unitId: ship.id, to, facing });
            applied = true;
          } catch {
            // an unreachable hex: nothing to compare
          }
          if (!applied) continue;
          const path = navalMovePath(state, ship, to, facing);
          expect(path).not.toBeNull();
          const end = path![path!.length - 1] ?? { hex: ship.position, facing: ship.facing };
          expect(hexKey(end.hex)).toBe(hexKey(mover.position));
          expect(end.facing).toBe(mover.facing);
          expect(checkSteps(ship, path!)).toBe(ship.movementLeft - mover.movementLeft);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('prefers a ramming contact at the hex over the cheapest plain state', () => {
    let sawContact = false;
    for (const { state, ship } of navalCases()) {
      for (const c of findRammingContacts(state, ship)) {
        if (hexKey(c.hex) === hexKey(ship.position)) continue;
        const path = navalMovePath(state, ship, c.hex, c.facing)!;
        expect(path[path.length - 1]!.facing).toBe(c.facing);
        sawContact = true;
      }
    }
    expect(sawContact).toBe(true);
  });
});
