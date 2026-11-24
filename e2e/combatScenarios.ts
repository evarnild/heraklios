// The positions the combat-resolution scenarios start from (§73), as data, so
// `combatScenarios.test.ts` can check each one headlessly against the engine
// (the seed does what the scenario says) and the browser spec only has to play
// it. Player 0 attacks, player 1 defends. Every hex is plain terrain with
// nothing river-crossed near it (the open land at q 8-14, r 3-6).
import type { Fixture } from './combatFixtures';

export interface Scenario {
  fixture: Fixture;
  attackerIds: string[];
  defenderIds: string[];
  /** The page seeds `Math.random` with this just before the attack. */
  seed: number;
}

const at = (q: number, r: number) => ({ q, r });

/** (a) A lone cavalry defender with three free hexes behind it; 8:2 is the 4-1 column, a DR on a 2-5. */
export const ADVANCE: Scenario = {
  fixture: {
    active: 0,
    units: [
      { id: 'fx-att', owner: 0, typeId: 'phalanges', at: at(10, 5) },
      { id: 'fx-def', owner: 1, typeId: 'cavalerie-legere', at: at(10, 4) },
    ],
  },
  attackerIds: ['fx-att'],
  defenderIds: ['fx-def'],
  seed: 0,
};

/** (f) The same, with friends on two of the three hexes behind the defender: one retreat hex is left. */
export const ONE_OPTION: Scenario = {
  fixture: {
    active: 0,
    units: [
      ...ADVANCE.fixture.units,
      { id: 'fx-f1', owner: 1, typeId: 'fantassins', at: at(11, 3) },
      { id: 'fx-f2', owner: 1, typeId: 'fantassins', at: at(10, 3) },
    ],
  },
  attackerIds: ['fx-att'],
  defenderIds: ['fx-def'],
  seed: 0,
};

/**
 * (b) Three attackers on one defender at 6-1 (20:2): a 5 or 6 is an EX. The
 * defender's force is 2, so any one attacker is a sufficient loss.
 */
export const EXCHANGE: Scenario = {
  fixture: {
    active: 0,
    units: [
      { id: 'fx-a1', owner: 0, typeId: 'phalanges', at: at(10, 5) },
      { id: 'fx-a2', owner: 0, typeId: 'chars-lourds', at: at(11, 4) },
      { id: 'fx-a3', owner: 0, typeId: 'fantassins-lourds', at: at(9, 5) },
      { id: 'fx-def', owner: 1, typeId: 'cavalerie-legere', at: at(10, 4) },
    ],
  },
  attackerIds: ['fx-a1', 'fx-a2', 'fx-a3'],
  defenderIds: ['fx-def'],
  seed: 4, // a 5
};

/**
 * (c) The defender's three hexes behind it are taken: two by enemy archers
 * (which also put the friend's other hexes in their zone of control), one by
 * a friend. It has nowhere to go and pushes the friend, who has one hex.
 */
export const PUSH: Scenario = {
  fixture: {
    active: 0,
    units: [
      ...ADVANCE.fixture.units,
      { id: 'fx-friend', owner: 1, typeId: 'fantassins', at: at(10, 3) },
      { id: 'fx-b1', owner: 0, typeId: 'archers', at: at(11, 3) },
      { id: 'fx-b2', owner: 0, typeId: 'archers', at: at(9, 4) },
    ],
  },
  attackerIds: ['fx-att'],
  defenderIds: ['fx-def'],
  seed: 0,
};

/**
 * (d) A drifting elephant: two chariots and a phalanx would be 3-1 (16:5), a DR
 * on a 1-5, and a DR makes an elephant drift. Seed 9 rolls a 3 for the attack,
 * a 3 for the direction (north, hex by hex towards r 0) and a 2 for the
 * trample's combat; the victim two hexes along it is a heavy infantry that
 * the elephant (8:3) forces back.
 */
export const DRIFT: Scenario = {
  fixture: {
    active: 0,
    units: [
      { id: 'fx-a1', owner: 0, typeId: 'chars-lourds', at: at(10, 5) },
      { id: 'fx-a2', owner: 0, typeId: 'phalanges', at: at(9, 5) },
      { id: 'fx-ele', owner: 1, typeId: 'elephants', at: at(10, 4) },
      { id: 'fx-vic', owner: 1, typeId: 'fantassins-lourds', at: at(10, 2) },
    ],
  },
  attackerIds: ['fx-a1', 'fx-a2'],
  defenderIds: ['fx-ele'],
  seed: 9,
};

/** (g) The same position as (a) with the seats swapped: the computer attacks, the human defends. */
export const COMPUTER_ATTACKS: Scenario = {
  fixture: {
    active: 1,
    seatControls: ['human', 'ai-greedy'],
    units: [
      { id: 'fx-att', owner: 1, typeId: 'phalanges', at: at(10, 5) },
      { id: 'fx-def', owner: 0, typeId: 'cavalerie-legere', at: at(10, 4) },
    ],
  },
  attackerIds: ['fx-att'],
  defenderIds: ['fx-def'],
  seed: 0,
};
