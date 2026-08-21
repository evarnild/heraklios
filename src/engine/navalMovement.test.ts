import { describe, it, expect } from 'vitest';
import {
  reachableNavalHexes,
  reachableNavalStates,
  findRammingContacts,
  navalContactHexKeys,
  resolveNavalAutoPathClick,
} from './navalMovement';
import { createInitialState } from './turnManager';
import { applyAction } from './actions';
import { DIRECTIONS } from './hex';
import { MAP_TERRAIN, hexKey as mapHexKey } from '../data/map';
import { TERRAIN_EFFECTS } from '../data/terrain';
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
    charged: false,
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

  // plan.md §17.3: manual step-by-step naval movement (BoardScene.ts) relies
  // on a single `navalMove` fired at exactly the bow-adjacent hex resolving
  // to a plain forward step at unchanged facing — i.e. that no rotate-detour
  // through the general (hex, facing) Dijkstra graph is ever cheaper than
  // entering that hex straight off the bow. Confirmed here before any UI
  // change assumed it: since every rotation costs 1 point, entering the hex
  // and then rotating costs strictly more than entering it directly, so the
  // direct entry is always weakly cheapest. Checked both at sea (moveCost 1)
  // and for a galley entering wide river from the coast (moveCost 3), so the
  // assertion isn't vacuously true only because every naval moveCost near
  // CENTER happens to be 1.
  it('the bow-adjacent hex is always reached at plain terrain cost with facing unchanged (plan.md §17.3)', () => {
    const ship = makeUnit({ typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 4 });
    const forwardOne = { q: CENTER.q + DIRECTIONS[0]!.q, r: CENTER.r + DIRECTIONS[0]!.r };
    const terrain = MAP_TERRAIN.get(mapHexKey(forwardOne.q, forwardOne.r))!;
    const reachable = reachableNavalHexes(makeState([ship]), ship);
    const entry = reachable.get(`${forwardOne.q},${forwardOne.r}`);
    expect(entry).toEqual({ cost: TERRAIN_EFFECTS[terrain].moveCost, facing: ship.facing });

    // Coast hex (22,5) faces wide river at (21,5) (direction index 3,
    // moveCost 3) on the shipped map — only a galley may enter it.
    const coastHex = { q: 22, r: 5 };
    const wideRiverHex = { q: 21, r: 5 };
    expect(MAP_TERRAIN.get(mapHexKey(coastHex.q, coastHex.r))).toBe('coast');
    expect(MAP_TERRAIN.get(mapHexKey(wideRiverHex.q, wideRiverHex.r))).toBe('river-wide');
    const galley = makeUnit({ typeId: 'galeres', position: coastHex, facing: 3, movementLeft: 5 });
    const galleyReachable = reachableNavalHexes(makeState([galley]), galley);
    const galleyEntry = galleyReachable.get(`${wideRiverHex.q},${wideRiverHex.r}`);
    expect(galleyEntry).toEqual({ cost: TERRAIN_EFFECTS['river-wide'].moveCost, facing: galley.facing });
    expect(galleyEntry!.cost).toBe(3);
  });

  // HIGH-1 review fix: `BoardScene`'s forward-step click fires `navalMove`
  // with `facing` pinned to the ship's CURRENT facing (see
  // `handleNavalMoveClick`), and `applyAction`'s `navalMove` case only takes
  // the ramming-contact branch when that pinned facing matches the
  // contact's — otherwise it must fall through to the plain terrain-cost
  // entry. These two cases exercise `applyAction` directly (not just
  // `reachableNavalHexes`) to pin that outcome, not just the input data.
  describe('applyAction resolves a facing-pinned forward click correctly (plan.md §17 review, HIGH-1)', () => {
    it('case (a): no enemy present — plain forward step at unchanged facing', () => {
      const ship = makeUnit({ id: 'a', typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 4 });
      const forwardOne = { q: CENTER.q + DIRECTIONS[0]!.q, r: CENTER.r + DIRECTIONS[0]!.r };
      const state = makeState([ship]);
      applyAction(state, { kind: 'navalMove', unitId: ship.id, to: forwardOne, facing: ship.facing });
      expect(ship.position).toEqual(forwardOne);
      expect(ship.facing).toBe(0);
      expect(ship.movementLeft).toBe(3); // sea moveCost 1, not overcharged
    });

    // Reproduces the exact scenario the reviewer verified: ship at (28,6)
    // facing 0, 4 MP; enemy at (30,5) sits bow-on to the bow-adjacent hex
    // (29,6) at facing 1 (cost 2: 1 to rotate + 1 to move), not facing 0 (the
    // ship's current facing, plain cost 1). Without the HIGH-1 fix,
    // `applyAction` picked the cheaper-sorted contact regardless of facing,
    // silently turning the ship to facing 1 and deducting 2 instead of 1 —
    // this assertion would have failed against that pre-fix behavior.
    it('case (b): a different-facing contact at the same hex does not hijack a facing-pinned forward click', () => {
      const ship = makeUnit({ id: 'a', typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 4 });
      const forwardOne = { q: CENTER.q + DIRECTIONS[0]!.q, r: CENTER.r + DIRECTIONS[0]!.r }; // (29,6)
      const enemyHex = { q: forwardOne.q + DIRECTIONS[1]!.q, r: forwardOne.r + DIRECTIONS[1]!.r }; // (30,5)
      const enemy = makeUnit({ id: 'd', typeId: 'biremes', owner: 1, position: enemyHex, movementLeft: 0 });
      const state = makeState([ship, enemy]);

      // Confirm the setup actually creates the trap: (29,6) is both plainly
      // reachable at facing 0 AND a ramming contact at facing 1.
      const contacts = findRammingContacts(state, ship).filter(
        (c) => c.hex.q === forwardOne.q && c.hex.r === forwardOne.r,
      );
      expect(contacts).toContainEqual(expect.objectContaining({ facing: 1, cost: 2 }));
      expect(contacts.some((c) => c.facing === 0)).toBe(false);

      applyAction(state, { kind: 'navalMove', unitId: ship.id, to: forwardOne, facing: ship.facing });
      expect(ship.position).toEqual(forwardOne);
      expect(ship.facing).toBe(0); // NOT auto-rotated to 1
      expect(ship.movementLeft).toBe(3); // plain terrain cost 1, NOT the contact's cost 2
    });
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

// plan.md §22.3.3 (BoardScene's new auto-path click, coexisting with §17's
// manual forward-hex click) plus the MEDIUM finding from this feature's own
// review: the guard against auto-pathing onto a ramming-contact hex had no
// test coverage at all — a reviewer deleting the guard line in
// `BoardScene.handleNavalMoveClick` left all 496 existing tests green. These
// exercise `resolveNavalAutoPathClick` directly (the Phaser-free function
// `handleNavalMoveClick`'s auto-path branch now calls verbatim, with no
// independent guard logic of its own left to silently regress) rather than
// `BoardScene.ts` itself, which cannot be imported under this project's
// Node-environment vitest config (`Phaser`'s `OS.js` throws
// `window is not defined` at import time — confirmed by hand while writing
// this test) — so this is the closest a test in this repo can come to
// exercising the click handler's own code, not just its inputs.
describe('resolveNavalAutoPathClick / navalContactHexKeys (plan.md §22.3.3)', () => {
  it('returns the cheapest route\'s ending facing for a plain reachable, non-contact hex', () => {
    const ship = makeUnit({ typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 3 });
    const state = makeState([ship]);
    // Direction 1 requires one turn + one move: cost 2, ending facing 1 (see
    // the "reaching a hex off the bow line" test above for the same math).
    const target = { q: CENTER.q + DIRECTIONS[1]!.q, r: CENTER.r + DIRECTIONS[1]!.r };
    const resolved = resolveNavalAutoPathClick(state, ship, target, findRammingContacts(state, ship));
    expect(resolved).toEqual({ to: target, facing: 1 });
  });

  it('returns null for a hex reachableNavalHexes does not report at all', () => {
    const ship = makeUnit({ typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 1 });
    const state = makeState([ship]);
    const tooFar = { q: CENTER.q + DIRECTIONS[0]!.q * 2, r: CENTER.r + DIRECTIONS[0]!.r * 2 };
    expect(resolveNavalAutoPathClick(state, ship, tooFar, findRammingContacts(state, ship))).toBeNull();
  });

  // The trap: hex A is plainly reachable at facing 1 (cost 2, the cheapest
  // way to arrive at all) but is ALSO a ramming-contact hex, at a DIFFERENT
  // facing (2, cost 3) reached by rotating one step further once there.
  // `reachableNavalHexes`/the cheapest route never resolves to facing 2, so
  // a naive auto-path click on A would silently fire a plain `navalMove` at
  // facing 1 that walks straight past a live ramming opportunity without
  // ever offering it — exactly the "click auto-solves the whole approach,
  // including past a ram" shortcut plan.md §22.4 keeps off-limits for every
  // hex but the forward one.
  it('is a no-op (null) for a hex that is reachable but is ALSO a ramming-contact hex at a different facing', () => {
    const ship = makeUnit({ id: 'a', typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 4 });
    const hexA = { q: CENTER.q + DIRECTIONS[1]!.q, r: CENTER.r + DIRECTIONS[1]!.r };
    const enemyHex = { q: hexA.q + DIRECTIONS[2]!.q, r: hexA.r + DIRECTIONS[2]!.r };
    const enemy = makeUnit({ id: 'd', typeId: 'biremes', owner: 1, position: enemyHex, movementLeft: 0 });
    const state = makeState([ship, enemy]);

    // Confirm the trap actually exists before relying on it: A's cheapest
    // reachable entry is facing 1 at cost 2 (not a contact facing)...
    const reachable = reachableNavalHexes(state, ship);
    expect(reachable.get(`${hexA.q},${hexA.r}`)).toEqual({ cost: 2, facing: 1 });
    // ...while a DIFFERENT, costlier route to the same hex (facing 2, cost
    // 3: rotate to 1, move, rotate to 2) is a live ramming contact.
    const contacts = findRammingContacts(state, ship);
    const contactAtA = contacts.filter((c) => c.hex.q === hexA.q && c.hex.r === hexA.r);
    expect(contactAtA).toContainEqual(expect.objectContaining({ facing: 2, cost: 3 }));
    expect(contactAtA.some((c) => c.facing === 1)).toBe(false);
    expect(navalContactHexKeys(contacts, ship.position).has(`${hexA.q},${hexA.r}`)).toBe(true);

    expect(resolveNavalAutoPathClick(state, ship, hexA, contacts)).toBeNull();
  });

  it('excludes every ramming-contact hex regardless of facing, even one only reachable at the ship\'s CURRENT facing', () => {
    // Simpler case: the contact facing matches the cheapest route's own
    // facing too (not just "some other reachable facing") — still excluded.
    const ship = makeUnit({ id: 'a', typeId: 'biremes', position: CENTER, facing: 0, movementLeft: 4 });
    const oneAhead = { q: CENTER.q + DIRECTIONS[0]!.q, r: CENTER.r + DIRECTIONS[0]!.r };
    const twoAhead = { q: oneAhead.q + DIRECTIONS[0]!.q, r: oneAhead.r + DIRECTIONS[0]!.r };
    const enemy = makeUnit({ id: 'd', typeId: 'biremes', owner: 1, position: twoAhead, movementLeft: 0 });
    const state = makeState([ship, enemy]);
    const contacts = findRammingContacts(state, ship);
    expect(contacts).toContainEqual(expect.objectContaining({ hex: oneAhead, facing: 0, cost: 1 }));
    expect(resolveNavalAutoPathClick(state, ship, oneAhead, contacts)).toBeNull();
  });

  it('navalContactHexKeys excludes the ship\'s own starting hex even if it is a contact', () => {
    const target = { q: CENTER.q + DIRECTIONS[0]!.q, r: CENTER.r + DIRECTIONS[0]!.r };
    const ship = makeUnit({ typeId: 'galeres', position: CENTER, facing: 0, movementLeft: 4 });
    const enemy = makeUnit({ id: 'd', typeId: 'galeres', owner: 1, position: target, movementLeft: 0 });
    const state = makeState([ship, enemy]);
    const contacts = findRammingContacts(state, ship);
    expect(contacts.some((c) => c.cost === 0)).toBe(true); // already bow-on at the start hex
    expect(navalContactHexKeys(contacts, ship.position).has(`${CENTER.q},${CENTER.r}`)).toBe(false);
  });
});
