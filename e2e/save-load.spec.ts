// Spec B9: from "Mode test", save to a slot through the save/load panel,
// make another move, load the slot back — the board returns to the saved
// position. `localStorage` slots only (each test gets a fresh browser
// context, so the slots start empty).
import { expect, test, type Page } from '@playwright/test';
import { MENU_TEST, activeUnitOfType, clickButton, clickHex, key, reachable, startFromMenu, state, unit, waitIdle } from './helpers';

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

/** The panel's Load button on the same row as the slot's Save button. */
async function loadOnSameRowAs(page: Page, savePoint: { x: number; y: number }) {
  const n = await page.evaluate(() => window.__heraklios.buttonCount('Load'));
  for (let i = 0; i < n; i++) {
    const p = await page.evaluate((j) => window.__heraklios.buttonToCanvas('Load', j), i);
    if (Math.abs(p.y - savePoint.y) < 1) return i;
  }
  throw new Error('No Load button on the saved row');
}

test('a saved game loads back to the saved position', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);

  await moveOneHex(page, 'fantassins');
  const saved = await state(page);

  await clickButton(page, SAVE_LOAD);
  const savePoint = await page.evaluate(() => window.__heraklios.buttonToCanvas('Save', 0));
  await clickButton(page, 'Save', 0);
  await clickButton(page, 'Close');
  await waitIdle(page);

  const second = await moveOneHex(page, 'archers');
  expect((await state(page)).units).not.toEqual(saved.units);

  await clickButton(page, SAVE_LOAD);
  await clickButton(page, 'Load', await loadOnSameRowAs(page, savePoint));
  await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  await waitIdle(page);

  expect(withoutClock(await state(page)), 'the loaded game equals the one saved').toEqual(withoutClock(saved));
  expect((await unit(page, second)).position, 'the second move is undone').toEqual(saved.units.find((u) => u.id === second)!.position);
  expect(errors).toEqual([]);
});
