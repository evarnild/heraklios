// Spec B8 (intents/43): the view centres on the active player's land units
// when the Board opens and when the turn passes. The scenario computes the
// target with the same pure function the game uses, from the dev hook's state.
import { expect, test, type Page } from '@playwright/test';
import { landUnitsCentre, nearestHex } from '../src/ui/viewCentre';
import { MENU_TEST, clickButton, startFromMenu, state, waitIdle } from './helpers';

const HEX_WIDTH = 44; // 2 * HEX_SIZE, at the default zoom of 1

async function targetHex(page: Page, owner: 0 | 1 | 2 | 3) {
  const centre = landUnitsCentre((await state(page)).units, owner);
  expect(centre, `player ${owner} has land units`).not.toBeNull();
  return nearestHex(centre!);
}

/** Canvas distance from the view's centre to a player's land-units centre; Infinity if off screen. Read-only. */
async function distanceToView(page: Page, owner: 0 | 1 | 2 | 3): Promise<number> {
  const hex = await targetHex(page, owner);
  const view = await page.evaluate(() => window.__heraklios.viewCentre());
  const pt = await page.evaluate((h) => window.__heraklios.hexToCanvas(h), hex);
  return pt ? Math.hypot(pt.x - view.x, pt.y - view.y) : Infinity;
}

/**
 * How far the hex's canvas position moves when the camera is centred on it
 * right now (the hook's centerOn clamps to the board's bounds like the game's
 * own centring does), so a target near the board's edge doesn't fail the
 * check. Infinity if it was off screen. Moves the camera: call it last.
 */
async function offsetFromBestView(page: Page, owner: 0 | 1 | 2 | 3): Promise<number> {
  const hex = await targetHex(page, owner);
  const at = () => page.evaluate((h) => window.__heraklios.hexToCanvas(h), hex);
  const before = await at();
  if (!before) return Infinity;
  await page.evaluate((h) => window.__heraklios.centerOn(h), hex);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const after = await at();
  return after ? Math.hypot(after.x - before.x, after.y - before.y) : Infinity;
}

test('the view follows the active player', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const st = await state(page);
  const [p1, p2] = [st.seatOrder[0]!, st.seatOrder[1]!];

  expect(await distanceToView(page, p1), 'player 1 land units centre on screen').toBeLessThan(Infinity);
  expect(await offsetFromBestView(page, p1), 'player 1 centred when the Board opens').toBeLessThanOrEqual(HEX_WIDTH);

  const before = await distanceToView(page, p2);
  await clickButton(page, 'End phase');
  await waitIdle(page);
  expect((await state(page)).phase).toBe('combat');
  await clickButton(page, 'End phase');
  await waitIdle(page);
  const after = await state(page);
  expect(after.phase).toBe('movement');
  expect(after.seatOrder[after.activePlayerIndex]).toBe(p2);

  const d2 = await distanceToView(page, p2);
  expect(d2, 'player 2 land units centre on screen').toBeLessThan(Infinity);
  expect(d2, 'player 2 now nearer the view centre than before').toBeLessThan(before);
  expect(d2, 'nearer than player 1').toBeLessThan(await distanceToView(page, p1));
  expect(await offsetFromBestView(page, p2), 'player 2 centred').toBeLessThanOrEqual(HEX_WIDTH);
  expect(errors).toEqual([]);
});
