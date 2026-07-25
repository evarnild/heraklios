import { describe, it, expect } from 'vitest';
import { reachableNavalHexes, reachableNavalStates, findRammingContacts } from './navalMovement';
import { createInitialState } from './turnManager';
import { DIRECTIONS } from './hex';
import type { GameState, Unit } from './state';

// (28,6) has every hex within 3 hexes as open sea on the shipped map — a
// clean patch to exercise facing-based naval movement without terrain
// restrictions getting in the way.
const CENTER = { q: 28, r: 6 };

function makeUnit(overrides: Partial<Unit> & { typeId: string; position: { q: number; r: number } }): Unit {
  return {
    id: overrides.id ?? `test-${Math.random()}`,
    owner: 0,
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    destroyed: false,
    ...overrides,
  };
}

function makeState(units: Unit[]): GameState {
  const state = createInitialState([], 'multi-defender');
  state.units = units;
  return state;
}

describe('reachableNavalStates / reachableNavalHexes', () => {
  it('rotating in place costs 1 point per 60° and never leaves the hex', () => {
    const ship = makeUnit({ typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 3 });
    const states = reachableNavalStates(makeState([ship]), ship);
    for (let f = 0; f < 6; f++) {
      const key = `${CENTER.q},${CENTER.r}|${f}`;
      const expectedCost = Math.min(Math.abs(f - 0), 6 - Math.abs(f - 0));
      expect(states.get(key)?.cost).toBe(expectedCost);
    }
    // Reachable HEXES excludes the ship's own starting hex regardless of facing spent getting there.
    expect(reachableNavalHexes(makeState([ship]), ship).has(`${CENTER.q},${CENTER.r}`)).toBe(false);
  });

  it('moves forward along its bow facing at 1 point per sea hex', () => {
    const ship = makeUnit({ typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 2 });
    const forwardOne = { q: CENTER.q + DIRECTIONS[0]!.q, r: CENTER.r + DIRECTIONS[0]!.r };
    const forwardTwo = { q: forwardOne.q + DIRECTIONS[0]!.q, r: forwardOne.r + DIRECTIONS[0]!.r };
    const reachable = reachableNavalHexes(makeState([ship]), ship);
    expect(reachable.get(`${forwardOne.q},${forwardOne.r}`)).toEqual({ cost: 1, facing: 0 });
    expect(reachable.get(`${forwardTwo.q},${forwardTwo.r}`)).toEqual({ cost: 2, facing: 0 });
  });

  it('reaching a hex off the bow line costs a turn plus the move', () => {
    const ship = makeUnit({ typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 3 });
    // Direction 1 requires a single 60° turn from facing 0, then one forward move: cost 1 + 1 = 2.
    const target = { q: CENTER.q + DIRECTIONS[1]!.q, r: CENTER.r + DIRECTIONS[1]!.r };
    const reachable = reachableNavalHexes(makeState([ship]), ship);
    expect(reachable.get(`${target.q},${target.r}`)).toEqual({ cost: 2, facing: 1 });
  });

  it('cannot enter a hex already occupied by another ship', () => {
    const ship = makeUnit({ id: 'mover', typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 2 });
    const forwardOne = { q: CENTER.q + DIRECTIONS[0]!.q, r: CENTER.r + DIRECTIONS[0]!.r };
    const blocker = makeUnit({ id: 'blocker', typeId: 'galeres', owner: 1, position: forwardOne, movementLeft: 0 });
    const reachable = reachableNavalHexes(makeState([ship, blocker]), ship);
    expect(reachable.has(`${forwardOne.q},${forwardOne.r}`)).toBe(false);
  });

  it('runs out of movement before reaching a too-distant hex', () => {
    const ship = makeUnit({ typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 1 });
    const forwardTwo = {
      q: CENTER.q + DIRECTIONS[0]!.q * 2,
      r: CENTER.r + DIRECTIONS[0]!.r * 2,
    };
    const reachable = reachableNavalHexes(makeState([ship]), ship);
    expect(reachable.has(`${forwardTwo.q},${forwardTwo.r}`)).toBe(false);
  });
});

describe('findRammingContacts', () => {
  it('reports a contact already available at the start hex, at max bonus if movement is untouched', () => {
    const target = { q: CENTER.q + DIRECTIONS[0]!.q, r: CENTER.r + DIRECTIONS[0]!.r };
    const attacker = makeUnit({ id: 'a', typeId: 'galeres', position: CENTER, facing: 0, movementLeft: 8 });
    const defender = makeUnit({ id: 'd', typeId: 'galeres', owner: 1, position: target, movementLeft: 0 });
    const contacts = findRammingContacts(makeState([attacker, defender]), attacker);
    const atStart = contacts.find((c) => c.cost === 0 && c.hex.q === CENTER.q && c.hex.r === CENTER.r);
    expect(atStart).toBeDefined();
    expect(atStart!.bonus).toBe(2);
    expect(atStart!.target.id).toBe('d');
  });

  it('lowers the bonus the more movement is spent reaching contact', () => {
    // Put the defender one further hex down the bow line: only reachable
    // (and bow-on) after spending 1 point moving forward, leaving 1 unused
    // out of a 2-point allowance.
    const oneAhead = { q: CENTER.q + DIRECTIONS[0]!.q, r: CENTER.r + DIRECTIONS[0]!.r };
    const twoAhead = { q: oneAhead.q + DIRECTIONS[0]!.q, r: oneAhead.r + DIRECTIONS[0]!.r };
    const attacker = makeUnit({ id: 'a', typeId: 'galeres', position: CENTER, facing: 0, movementLeft: 2 });
    const defender = makeUnit({ id: 'd', typeId: 'galeres', owner: 1, position: twoAhead, movementLeft: 0 });
    const contacts = findRammingContacts(makeState([attacker, defender]), attacker);
    const contact = contacts.find((c) => c.hex.q === oneAhead.q && c.hex.r === oneAhead.r);
    expect(contact).toBeDefined();
    expect(contact!.cost).toBe(1);
    expect(contact!.bonus).toBe(1); // 2 - 1 = 1 unused point left
  });

  it('ignores friendly ships and non-naval units', () => {
    const target = { q: CENTER.q + DIRECTIONS[0]!.q, r: CENTER.r + DIRECTIONS[0]!.r };
    const attacker = makeUnit({ id: 'a', typeId: 'galeres', position: CENTER, facing: 0, movementLeft: 4 });
    const friendly = makeUnit({ id: 'f', typeId: 'galeres', owner: 0, position: target, movementLeft: 0 });
    const contacts = findRammingContacts(makeState([attacker, friendly]), attacker);
    expect(contacts.some((c) => c.cost === 0)).toBe(false);
  });
});
