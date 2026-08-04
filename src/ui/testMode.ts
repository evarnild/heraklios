import { session } from './session';
import { deploymentBand, seaZoneNear } from './mapBounds';
import { createInitialState } from '../engine/turnManager';
import { emptySelection } from '../engine/army';
import type { Unit, Player, PlayerId } from '../engine/state';
import { UNIT_TYPES, getUnitType } from '../data/units';
import type { HexCoord } from '../data/map';

const LAND_TEST_UNITS = ['fantassins', 'archers', 'cavalerie-legere'];
const NAVAL_TEST_UNITS = ['galeres', 'biremes'];

let unitCounter = 0;

function makeUnit(owner: PlayerId, typeId: string, position: HexCoord, facing = 0): Unit {
  const t = getUnitType(typeId);
  return {
    id: `test-u${unitCounter++}`,
    owner,
    typeId,
    position,
    movementLeft: t.movement,
    facing,
    equipmentPoints: t.domain === 'naval' ? Math.ceil(t.defense / 5) : undefined,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

/**
 * Developer/testing shortcut: skips army-building and placement entirely and
 * jumps straight into a 2-player game, each side already holding 3 land
 * units and 2 naval units on opposite edges of the map (west vs east, so
 * they're within reach of each other for testing combat).
 */
export function startTestGame(): void {
  unitCounter = 0;
  session.playerCount = 2;
  session.testMode = true;
  session.edges = ['W', 'E'];
  // These shortcuts build units directly, bypassing `ArmyBuilder`/
  // `resetSession` entirely — so unlike a real game, nothing else ever sizes
  // `armySelections` to match `playerCount`. Left stale (e.g. from an
  // abandoned real game with a different player count — see `resetToMenu`'s
  // doc comment), it would otherwise get baked into this game's own save
  // file with a mismatched length. `resetToMenu` already clears it to `[]`
  // on abandon; this sets it back to a *correctly-sized* (if unused) array
  // so a save captured mid test-mode game is internally consistent too.
  session.armySelections = Array.from({ length: 2 }, () => emptySelection());

  const players: Player[] = [
    { id: 0 as PlayerId, name: session.playerNames[0]!, edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1 as PlayerId, name: session.playerNames[1]!, edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const state = createInitialState(players, session.combatMode, session.randomizedTurnOrder);

  players.forEach((player) => {
    // The test-mode shortcuts skip the interactive placement UI entirely,
    // they just need a handful of valid land hexes near this player's edge.
    const landHexes = deploymentBand(player.edge).filter(
      (hex) => !state.units.some((u) => u.position.q === hex.q && u.position.r === hex.r),
    );
    LAND_TEST_UNITS.forEach((typeId, i) => {
      const hex = landHexes[i];
      if (hex) state.units.push(makeUnit(player.id, typeId, hex));
    });

    const seaHexes = seaZoneNear(player.edge).filter(
      (hex) => !state.units.some((u) => u.position.q === hex.q && u.position.r === hex.r),
    );
    NAVAL_TEST_UNITS.forEach((typeId, i) => {
      const hex = seaHexes[i];
      if (hex) state.units.push(makeUnit(player.id, typeId, hex));
    });
  });

  session.gameState = state;
}

/**
 * Developer/testing shortcut for combat specifically: a 2-player game with
 * one of every land unit type lined up in two parallel rows, 2 hexes apart
 * (rows r=3 and r=5, q=10.. — confirmed all-plain terrain on the shipped
 * map), rather than scattered across deployment zones. Every unit directly
 * faces its counterpart at exactly range 2 (archers can fire immediately;
 * melee units are one move from contact), and neighbors within each row are
 * adjacent to each other — so multi-unit attack groups can be tested right
 * away without hunting across the map for reachable targets.
 *
 * Also lays out one of every naval unit type in two parallel rows out on
 * open sea (rows r=7 and r=9, q=25.. — confirmed all-sea on the shipped
 * map), 2 hexes apart and bows-on to their counterpart, same as the land
 * rows: one forward move brings a ship into ramming contact, which also
 * makes boarding available (parallel facing) without hunting across the
 * map for water.
 */
export function startCloseCombatTestGame(): void {
  unitCounter = 0;
  session.playerCount = 2;
  session.testMode = true;
  session.edges = ['W', 'E'];
  // These shortcuts build units directly, bypassing `ArmyBuilder`/
  // `resetSession` entirely — so unlike a real game, nothing else ever sizes
  // `armySelections` to match `playerCount`. Left stale (e.g. from an
  // abandoned real game with a different player count — see `resetToMenu`'s
  // doc comment), it would otherwise get baked into this game's own save
  // file with a mismatched length. `resetToMenu` already clears it to `[]`
  // on abandon; this sets it back to a *correctly-sized* (if unused) array
  // so a save captured mid test-mode game is internally consistent too.
  session.armySelections = Array.from({ length: 2 }, () => emptySelection());

  const players: Player[] = [
    { id: 0 as PlayerId, name: session.playerNames[0]!, edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1 as PlayerId, name: session.playerNames[1]!, edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const state = createInitialState(players, session.combatMode, session.randomizedTurnOrder);

  const landTypeIds = UNIT_TYPES.filter((t) => t.domain === 'land').map((t) => t.id);
  const baseQ = 10;
  landTypeIds.forEach((typeId, i) => {
    state.units.push(makeUnit(0 as PlayerId, typeId, { q: baseQ + i, r: 3 }));
    state.units.push(makeUnit(1 as PlayerId, typeId, { q: baseQ + i, r: 5 }));
  });

  // Facings 5 ({q:0,r:+1}, "south") and 2 ({q:0,r:-1}, "north") point the two
  // rows' bows directly at each other across the r=8 gap.
  const navalTypeIds = UNIT_TYPES.filter((t) => t.domain === 'naval').map((t) => t.id);
  const navalBaseQ = 25;
  navalTypeIds.forEach((typeId, i) => {
    state.units.push(makeUnit(0 as PlayerId, typeId, { q: navalBaseQ + i, r: 7 }, 5));
    state.units.push(makeUnit(1 as PlayerId, typeId, { q: navalBaseQ + i, r: 9 }, 2));
  });

  session.gameState = state;
}
