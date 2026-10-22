// Spec B9: from "Test mode", save to a slot through the save/load panel,
// make another move, load the slot back — the board returns to the saved
// position. The saves are files behind the local save API (§45): the server
// started by playwright.config.ts writes them into a temporary folder, and
// the scenario reads the slot's file once to check the round trip (AC4).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  MENU_TEST,
  activeUnitOfType,
  clickButton,
  clickHex,
  key,
  loadOnSameRowAs,
  reachable,
  startFromMenu,
  state,
  unit,
  waitIdle,
  waitSavePanelLoaded,
} from './helpers';
import { SAVES_DIR } from './savesDir';

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]] as const;
const SAVE_LOAD = '💾 Save / Load';

/**
 * The state minus the game clock: `elapsedMs` ticks every frame while the
 * board is up (turnManager's advanceGameClock), so the value captured here
 * and the one in the save differ by a few milliseconds by construction.
 */
const withoutClock = ({ elapsedMs: _clock, ...rest }: Awaited<ReturnType<typeof state>>) => rest;

async function moveOneHex(page: Page, typeId: string) {
  const mover = await activeUnitOfType(page, typeId);
  const reach = await reachable(page, mover.id);
  const to = DIRS.map(([dq, dr]) => ({ q: mover.position.q + dq, r: mover.position.r + dr })).find((h) => reach.includes(key(h)));
  if (!to) throw new Error(`${typeId} has no adjacent reachable hex`);
  await clickHex(page, mover.position);
  await clickHex(page, to);
  await waitIdle(page);
  expect((await unit(page, mover.id)).position).toEqual(to);
  return mover.id;
}

test('a saved game loads back to the saved position', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);

  await moveOneHex(page, 'fantassins');
  const saved = await state(page);

  await clickButton(page, SAVE_LOAD);
  await waitSavePanelLoaded(page);
  const savePoint = await page.evaluate(() => window.__heraklios.buttonToCanvas('Save', 0));
  await clickButton(page, 'Save', 0);
  // The file appears once the API answered; the row's Load button comes on with it.
  await page.waitForFunction(() => window.__heraklios.buttonCount('Load') > 0);
  await clickButton(page, 'Close');
  await waitIdle(page);

  // AC4: the slot is a readable JSON file holding the position that was saved.
  const onDisk = JSON.parse(readFileSync(join(SAVES_DIR, 'slot-1.json'), 'utf8')) as { version: number; gameState: { units: unknown } };
  expect(onDisk.version).toBe(3);
  expect(onDisk.gameState.units).toEqual(saved.units);

  const second = await moveOneHex(page, 'archers');
  expect((await state(page)).units).not.toEqual(saved.units);

  await clickButton(page, SAVE_LOAD);
  await waitSavePanelLoaded(page);
  await clickButton(page, 'Load', await loadOnSameRowAs(page, savePoint));
  await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  await waitIdle(page);

  expect(withoutClock(await state(page)), 'the loaded game equals the one saved').toEqual(withoutClock(saved));
  expect((await unit(page, second)).position, 'the second move is undone').toEqual(saved.units.find((u) => u.id === second)!.position);
  expect(errors).toEqual([]);
});
