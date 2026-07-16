import { session } from './session';
import { deploymentZone, seaZoneNear } from './mapBounds';
import { createInitialState } from '../engine/turnManager';
import type { Unit, Player, PlayerId } from '../engine/state';
import { getUnitType } from '../data/units';
import type { HexCoord } from '../data/map';

const LAND_TEST_UNITS = ['fantassins', 'archers', 'cavalerie-legere'];
const NAVAL_TEST_UNITS = ['galeres', 'biremes'];

let unitCounter = 0;

function makeUnit(owner: PlayerId, typeId: string, position: HexCoord): Unit {
  const t = getUnitType(typeId);
  return {
    id: `test-u${unitCounter++}`,
    owner,
    typeId,
    position,
    movementLeft: t.movement,
    facing: 0,
    equipmentPoints: t.domain === 'naval' ? Math.ceil(t.defense / 5) : undefined,
    hasRetreatedThisPhase: false,
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
  session.edges = ['W', 'E'];

  const players: Player[] = [
    { id: 0 as PlayerId, name: session.playerNames[0]!, edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1 as PlayerId, name: session.playerNames[1]!, edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const state = createInitialState(players);

  players.forEach((player) => {
    const landHexes = deploymentZone(player.edge).filter(
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
