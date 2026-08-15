import { beforeEach, describe, expect, it } from 'vitest';
import { autoPlaceSeat, skipAiArmySeats, skipAiPlacementSeats } from './aiSetup';
import { legalDeploymentHexes } from './mapBounds';
import { session } from './session';
import { defaultArmySelection, emptySelection } from '../engine/army';
import { unitCategory } from '../engine/movement';
import { createInitialState } from '../engine/turnManager';
import { createSeededRng } from '../engine/rng';
import type { GameState, Player, PlayerId } from '../engine/state';
import type { SeatControl } from '../engine/seatControl';
import { canEnterTerrain, isSeaLike } from '../data/terrain';
import { MAP_TERRAIN, hexKey } from '../data/map';
import { getUnitType } from '../data/units';

/** The unit types `aiSetup`'s deployment preference keeps off plateaux —
 * cavalry (both), chariots (both), and heavy infantry. Spelled out here
 * rather than imported so the test states the intended list independently
 * of the predicate it is checking; a change to one has to be a deliberate
 * change to the other. Phalanxes are deliberately absent: they are heavy
 * foot that WANTS defensive ground. */
const KEEPS_OFF_PLATEAUX = new Set([
  'cavalerie-legere',
  'cavalerie-lourde',
  'chars-legers',
  'chars-lourds',
  'fantassins-lourds',
]);

function setUpSession(controls: SeatControl[]): void {
  session.playerCount = controls.length;
  session.playerNames = ['Athènes', 'Perse', 'Macédoine', 'Sparte'];
  session.edges = ['W', 'E', 'N', 'S'].slice(0, controls.length) as typeof session.edges;
  session.seatControls = [...controls, ...Array<SeatControl>(4).fill('human')].slice(0, 4);
  session.armySelections = controls.map(() => emptySelection());
  session.gameState = null;
}

function twoPlayerState(): GameState {
  const players: Player[] = [
    { id: 0 as PlayerId, name: 'Athènes', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1 as PlayerId, name: 'Perse', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  return createInitialState(players, 'multi-defender');
}

/** One seat on a chosen edge — lets a test aim at the band whose terrain
 * makes the sharpest probe, rather than always at the western one. */
function singleSeatState(edge: 'N' | 'S' | 'E' | 'W'): GameState {
  const players: Player[] = [{ id: 0 as PlayerId, name: 'Athènes', edge, purchasePoints: 400, eliminated: false }];
  return createInitialState(players, 'multi-defender');
}

/** Deterministic stand-in for `Math.random`, so a placement run is
 * reproducible and a failure is a real one rather than an unlucky seed. */
function cyclingRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('skipAiArmySeats', () => {
  beforeEach(() => setUpSession(['human', 'human']));

  it('returns the starting seat unchanged when it is human, touching nothing', () => {
    expect(skipAiArmySeats(0)).toBe(0);
    expect(session.armySelections[0]).toEqual(emptySelection());
  });

  it('fills each AI seat with the default army and reports the next human seat', () => {
    setUpSession(['ai-ev', 'human']);
    expect(skipAiArmySeats(0)).toBe(1);
    expect(session.armySelections[0]).toEqual(defaultArmySelection());
    // The human seat is left alone — it is about to build its own.
    expect(session.armySelections[1]).toEqual(emptySelection());
  });

  it('returns null when every remaining seat is an AI', () => {
    setUpSession(['ai-random', 'ai-greedy']);
    expect(skipAiArmySeats(0)).toBeNull();
    expect(session.armySelections[0]).toEqual(defaultArmySelection());
    expect(session.armySelections[1]).toEqual(defaultArmySelection());
  });

  it('ignores seats past playerCount', () => {
    setUpSession(['human', 'human']);
    session.seatControls[2] = 'ai-ev';
    expect(skipAiArmySeats(0)).toBe(0);
    expect(session.armySelections[2]).toBeUndefined();
  });
});

describe('autoPlaceSeat', () => {
  beforeEach(() => setUpSession(['human', 'human']));

  it('places every unit of the selection, once each', () => {
    const state = twoPlayerState();
    session.armySelections[0] = defaultArmySelection();
    autoPlaceSeat(state, 0, cyclingRng([0.1, 0.37, 0.64, 0.83, 0.02]));

    const selection = defaultArmySelection();
    const expected = Object.values(selection).reduce((sum, n) => sum + (n ?? 0), 0);
    expect(state.units).toHaveLength(expected);
    for (const [typeId, count] of Object.entries(selection)) {
      expect(state.units.filter((u) => u.typeId === typeId)).toHaveLength(count ?? 0);
    }
    expect(state.units.every((u) => u.owner === 0)).toBe(true);
  });

  it('gives every unit a unique id and a unique hex', () => {
    const state = twoPlayerState();
    session.armySelections[0] = defaultArmySelection();
    autoPlaceSeat(state, 0, cyclingRng([0.9, 0.13, 0.5, 0.71, 0.28]));

    expect(new Set(state.units.map((u) => u.id)).size).toBe(state.units.length);
    expect(new Set(state.units.map((u) => hexKey(u.position.q, u.position.r))).size).toBe(state.units.length);
  });

  it('never deploys a unit onto terrain it may not enter', () => {
    // Chariots are barred from BOTH flanc-abrupt and marais, so an army of
    // nothing but chariots is the sharpest probe of the terrain filter.
    //
    // The SOUTHERN band, 20 chariots, 20 seeds — not one small placement on
    // the western band, which is what the first version of this test did and
    // which **survived deleting the filter it was named for**. Only 4 of the
    // W band's 90 hexes are barred to a chariot (4.4%), so eight draws
    // missed all of them and the test passed either way. The S band is 39 of
    // 126 (31%), and 400 draws across it make a missing filter a certainty,
    // not a coin flip. Re-verified by mutation: deleting the filter fails
    // this test on the first seed.
    const barredShare = (edge: 'N' | 'S' | 'E' | 'W') => {
      const band = legalDeploymentHexes(edge, []);
      const barred = band.filter((h) => {
        const terrain = MAP_TERRAIN.get(hexKey(h.q, h.r));
        return terrain !== undefined && !canEnterTerrain(terrain, unitCategory('chars-lourds'));
      });
      return barred.length / band.length;
    };
    // Control: this probe is only meaningful while the chosen band really
    // does contain a lot of hexes a chariot may not stand on.
    expect(barredShare('S')).toBeGreaterThan(0.2);

    for (let seed = 1; seed <= 20; seed++) {
      const state = singleSeatState('S');
      session.armySelections[0] = { ...emptySelection(), 'chars-lourds': 20 };
      autoPlaceSeat(state, 0, createSeededRng(seed));

      expect(state.units).toHaveLength(20);
      for (const unit of state.units) {
        const terrain = MAP_TERRAIN.get(hexKey(unit.position.q, unit.position.r))!;
        expect(
          canEnterTerrain(terrain, unitCategory(unit.typeId)),
          `seed ${seed}: ${unit.typeId} on ${terrain} at (${unit.position.q}, ${unit.position.r})`,
        ).toBe(true);
      }
    }
  });

  it('deploys land units in the seat\'s own band and ships in its sea zone', () => {
    const state = twoPlayerState();
    session.armySelections[0] = { ...emptySelection(), fantassins: 3, galeres: 2 };
    autoPlaceSeat(state, 0, cyclingRng([0.3, 0.66, 0.12, 0.88, 0.41]));

    for (const unit of state.units) {
      const terrain = MAP_TERRAIN.get(hexKey(unit.position.q, unit.position.r))!;
      const naval = getUnitType(unit.typeId).domain === 'naval';
      // Ships in water (a named bay or open sea), land units never in it.
      expect(isSeaLike(terrain)).toBe(naval);
    }
  });

  it('gives ships their full equipment and a legal facing, land units neither', () => {
    const state = twoPlayerState();
    session.armySelections[0] = { ...emptySelection(), fantassins: 1, triremes: 2 };
    autoPlaceSeat(state, 0, cyclingRng([0.4, 0.7, 0.15]));

    for (const unit of state.units) {
      if (getUnitType(unit.typeId).domain === 'naval') {
        expect(unit.equipmentPoints).toBeGreaterThan(0);
        expect(unit.facing).toBeGreaterThanOrEqual(0);
        expect(unit.facing).toBeLessThan(6);
      } else {
        expect(unit.equipmentPoints).toBeUndefined();
        expect(unit.facing).toBe(0);
      }
    }
  });

  it('keeps clear of hexes another army already occupies', () => {
    // Seat 1 deploys second; `legalDeploymentHexes`' minGap plus the
    // occupancy check must keep it off seat 0's units.
    const state = twoPlayerState();
    session.armySelections[0] = defaultArmySelection();
    session.armySelections[1] = defaultArmySelection();
    autoPlaceSeat(state, 0, cyclingRng([0.2, 0.55, 0.8, 0.35]));
    autoPlaceSeat(state, 1, cyclingRng([0.6, 0.25, 0.44, 0.91]));

    const keys = state.units.map((u) => hexKey(u.position.q, u.position.r));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps cavalry, chariots and heavy infantry off plateaux', () => {
    // The SOUTHERN band is the worst case on this map and therefore the only
    // honest place to test this: 44 of its 126 hexes are plateau (34.9%) and
    // another 37 are steep flanks a chariot may not enter at all, leaving 43
    // plain hexes for a default army's 22 plateau-avoiding units. A band with
    // room to spare would pass whether or not the preference existed.
    for (let seed = 1; seed <= 20; seed++) {
      const state = singleSeatState('S');
      session.armySelections[0] = defaultArmySelection();
      autoPlaceSeat(state, 0, createSeededRng(seed));

      for (const unit of state.units) {
        if (!KEEPS_OFF_PLATEAUX.has(unit.typeId)) continue;
        const terrain = MAP_TERRAIN.get(hexKey(unit.position.q, unit.position.r))!;
        expect(terrain, `seed ${seed}: ${unit.typeId} at (${unit.position.q}, ${unit.position.r})`).not.toBe(
          'plateau',
        );
      }
    }
  });

  it('still puts the units that hold ground on plateaux — this is a preference, not a ban', () => {
    // Control for the test above: if `autoPlaceSeat` had simply stopped using
    // plateaux altogether, that test would pass for the wrong reason. Archers,
    // phalanxes and elephants are exactly the units that should be getting
    // the defensive ground the others give up.
    let usedPlateau = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const state = singleSeatState('S');
      session.armySelections[0] = defaultArmySelection();
      autoPlaceSeat(state, 0, createSeededRng(seed));
      usedPlateau += state.units.filter(
        (u) => MAP_TERRAIN.get(hexKey(u.position.q, u.position.r)) === 'plateau',
      ).length;
    }
    expect(usedPlateau).toBeGreaterThan(0);
  });

  it('takes a plateau rather than failing when nothing else is left', () => {
    // The preference must not become a hard constraint that can starve a
    // deployment: 40 chariots on the southern band need more hexes than its
    // 43 plain ones comfortably provide once the draw scatters them, and a
    // ban would throw instead of falling back.
    const state = singleSeatState('S');
    session.armySelections[0] = { ...emptySelection(), 'chars-lourds': 60 };
    expect(() => autoPlaceSeat(state, 0, createSeededRng(7))).not.toThrow();
    expect(state.units).toHaveLength(60);
    // And the fallback really was exercised — some had to take plateaux.
    const onPlateau = state.units.filter(
      (u) => MAP_TERRAIN.get(hexKey(u.position.q, u.position.r)) === 'plateau',
    );
    expect(onPlateau.length).toBeGreaterThan(0);
    // Legality is still absolute, however crowded it gets.
    for (const unit of state.units) {
      const terrain = MAP_TERRAIN.get(hexKey(unit.position.q, unit.position.r))!;
      expect(canEnterTerrain(terrain, unitCategory(unit.typeId))).toBe(true);
    }
  });

  it('deploys the plateau-avoiding units first, so the others cannot take their ground', () => {
    // Most-constrained-first is what makes the preference survive a crowded
    // band (see `unitsInPlacementOrder`). Ids are handed out in placement
    // order, so the ordering is observable from the finished board.
    const state = singleSeatState('S');
    session.armySelections[0] = defaultArmySelection();
    autoPlaceSeat(state, 0, createSeededRng(3));

    const landUnits = state.units.filter((u) => getUnitType(u.typeId).domain === 'land');
    const indexOf = (u: (typeof landUnits)[number]) => Number(u.id.split('u')[1]);
    const lastRestricted = Math.max(
      ...landUnits.filter((u) => KEEPS_OFF_PLATEAUX.has(u.typeId)).map(indexOf),
    );
    const firstUnrestricted = Math.min(
      ...landUnits.filter((u) => !KEEPS_OFF_PLATEAUX.has(u.typeId)).map(indexOf),
    );
    expect(lastRestricted).toBeLessThan(firstUnrestricted);
  });

  it('throws rather than deploying a short army when the zone runs out of room', () => {
    const state = twoPlayerState();
    // Far more chariots than the (terrain-filtered) western band can hold.
    session.armySelections[0] = { ...emptySelection(), 'chars-lourds': 500 };
    expect(() => autoPlaceSeat(state, 0, cyclingRng([0.5]))).toThrow(/no legal hex/);
  });
});

describe('skipAiPlacementSeats', () => {
  it('deploys the run of AI seats and stops at the first human one', () => {
    setUpSession(['ai-ev', 'human']);
    session.armySelections[0] = defaultArmySelection();
    const state = twoPlayerState();

    expect(skipAiPlacementSeats(state, 0, cyclingRng([0.3, 0.7, 0.1]))).toBe(1);
    expect(state.units.length).toBeGreaterThan(0);
    expect(state.units.every((u) => u.owner === 0)).toBe(true);
  });

  it('returns null once every remaining seat is an AI', () => {
    setUpSession(['ai-ev', 'ai-random']);
    session.armySelections[0] = defaultArmySelection();
    session.armySelections[1] = defaultArmySelection();
    const state = twoPlayerState();

    expect(skipAiPlacementSeats(state, 0, cyclingRng([0.3, 0.7, 0.1]))).toBeNull();
    expect(state.units.some((u) => u.owner === 0)).toBe(true);
    expect(state.units.some((u) => u.owner === 1)).toBe(true);
  });
});
