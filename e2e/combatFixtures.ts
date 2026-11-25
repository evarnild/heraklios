// Crafted positions for the combat-resolution scenarios (§73). Each one is a
// `SavedGame` built from the Board's own live state (so every field the game
// reads is there), with the units replaced by the ones a scenario names. It is
// written to slot 4 of the e2e saves folder and loaded through the Save/Load
// panel, as a player would, so the Board is loaded in place and `testMode` is
// false: a die roll then clears the history, which the boundary scenarios need
// to observe.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { UNIT_TYPES } from '../src/data/units';
import { buildSavedGame, type SavedGame } from '../src/engine/saveGame';
import type { SeatControl } from '../src/engine/seatControl';
import { maxEquipmentPointsForType, type GameState, type PlayerId, type Unit } from '../src/engine/state';
import {
  clickButton,
  loadOnSameRowAs,
  waitIdle,
  waitLoadOnRowOf,
  waitSavePanelLoaded,
  type Hex,
} from './helpers';
import { SAVES_DIR } from './savesDir';

/** The slot the fixtures use; no other scenario writes it. */
export const FIXTURE_SLOT = 4;

export interface FixtureUnit {
  id: string;
  owner: PlayerId;
  typeId: string;
  at: Hex;
}

export interface Fixture {
  units: FixtureUnit[];
  /** Who attacks (the active player in the combat phase). */
  active: PlayerId;
  /** Per seat; absent means both human. */
  seatControls?: SeatControl[];
  /** Units that already attacked this phase. */
  attacked?: string[];
}

function unitFrom(f: FixtureUnit): Unit {
  const t = UNIT_TYPES.find((u) => u.id === f.typeId);
  if (!t) throw new Error(`No unit type ${f.typeId}`);
  return {
    id: f.id,
    owner: f.owner,
    typeId: f.typeId,
    position: { ...f.at },
    movementLeft: t.movement,
    facing: 0,
    equipmentPoints: t.domain === 'naval' ? maxEquipmentPointsForType(t) : undefined,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

/** The state `fixture` describes, on top of `base` (a copy of a live two-player state). */
export function craftedState(base: GameState, fixture: Fixture): GameState {
  const state = structuredClone(base);
  state.units = fixture.units.map(unitFrom);
  state.phase = 'combat';
  state.activePlayerIndex = state.seatOrder.indexOf(fixture.active);
  if (state.activePlayerIndex < 0) throw new Error(`Player ${fixture.active} is not seated`);
  return state;
}

/** The save file for `fixture`, in the shape the Save/Load panel loads. */
export function craftedSave(base: GameState, fixture: Fixture): SavedGame {
  const state = craftedState(base, fixture);
  return buildSavedGame({
    savedAt: new Date(0).toISOString(),
    playerCount: state.players.length,
    playerNames: state.players.map((p) => p.name),
    edges: state.players.map((p) => p.edge),
    armySelections: state.players.map(() => ({})),
    combatMode: state.combatMode,
    seatControls: fixture.seatControls ?? state.players.map(() => 'human' as const),
    testMode: false,
    gameState: state,
    attackedThisPhase: fixture.attacked ?? [],
    rammedThisTurn: [],
  });
}

const SAVE_LOAD = '💾 Save / Load';

/**
 * Writes `fixture` to slot 4 and loads it through the Save/Load panel. The
 * caller holds the save lock (`acquireSaveLock`); the page is on the Board.
 */
export async function loadFixture(page: Page, base: GameState, fixture: Fixture, beforeLoad?: () => Promise<void>): Promise<void> {
  writeFileSync(join(SAVES_DIR, `slot-${FIXTURE_SLOT}.json`), JSON.stringify(craftedSave(base, fixture)));
  await clickButton(page, SAVE_LOAD);
  await waitSavePanelLoaded(page);
  const savePoint = await page.evaluate((i) => window.__heraklios.buttonToCanvas('Save', i), FIXTURE_SLOT - 1);
  await waitLoadOnRowOf(page, savePoint);
  const load = await loadOnSameRowAs(page, savePoint);
  await beforeLoad?.(); // a computer seat attacks as the game loads: the dice are seeded just before
  await clickButton(page, 'Load', load);
  await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  // The Board scene is up before the save arrives over HTTP: wait for the load itself (the crafted
  // phase and units), reading the hook as "not yet" while the scene restarts.
  const ids = fixture.units.map((u) => u.id).sort();
  await page.waitForFunction((want) => {
    try {
      const st = window.__heraklios.state() as GameState;
      return st.phase === 'combat' && JSON.stringify(st.units.map((u) => u.id).sort()) === JSON.stringify(want);
    } catch {
      return false;
    }
  }, ids);
  // A computer seat starts its turn on load, and may be waiting on a human answer: not idle.
  if (!(fixture.seatControls ?? []).some((c) => c !== 'human')) await waitIdle(page);
  const loaded = await page.evaluate(() => window.__heraklios.state()) as GameState;
  expect(loaded.phase, 'the crafted game is loaded').toBe('combat');
  expect(loaded.units.map((u) => u.id).sort()).toEqual(fixture.units.map((u) => u.id).sort());
}
