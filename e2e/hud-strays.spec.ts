// §67: no object on the Board is drawn by both cameras. The map camera draws
// the world, the fixed HUD camera the HUD; an object both render is drawn
// twice (the Standard view's drift arrow once was, at depth 12).
import { expect, test } from '@playwright/test';
import { MENU_TEST, activeUnitOfType, clickButton, clickHex, startFromMenu, waitIdle } from './helpers';

const DRAWN = '🗺 Drawn view';

type Scan = { examined: number; hudOnly: number; strays: { type: string; depth: number }[] };

// The scan must have really looked at the HUD (hudOnly > 0: objects only the
// HUD camera renders) and past it (examined > hudOnly), or an empty `strays`
// proves nothing: a reader that examines nothing also reports none.
function expectScan(scan: Scan, label: string) {
  expect(scan.strays, label).toEqual([]);
  expect(scan.hudOnly, `${label}: HUD objects seen`).toBeGreaterThan(0);
  expect(scan.examined, `${label}: examined beyond HUD`).toBeGreaterThan(scan.hudOnly);
}

test('no display-list object is rendered by both cameras, in either view', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const mover = await activeUnitOfType(page, 'fantassins');
  await clickHex(page, mover.position);
  await waitIdle(page);

  expect(await page.evaluate(() => window.__heraklios.boardView())).toBe('standard');
  expectScan(await page.evaluate(() => window.__heraklios.hudStrays()), 'Standard view');

  await clickButton(page, DRAWN);
  await page.waitForFunction(() => window.__heraklios.boardView() === 'drawn');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expectScan(await page.evaluate(() => window.__heraklios.hudStrays()), 'Drawn view');
  expect(errors).toEqual([]);
});
