// §67: no object on the Board is drawn by both cameras. The map camera draws
// the world, the fixed HUD camera the HUD; an object both render is drawn
// twice (the Standard view's drift arrow once was, at depth 12).
import { expect, test } from '@playwright/test';
import { MENU_TEST, activeUnitOfType, clickButton, clickHex, startFromMenu, waitIdle } from './helpers';

const DRAWN = '🗺 Drawn view';

test('no display-list object is rendered by both cameras, in either view', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const mover = await activeUnitOfType(page, 'fantassins');
  await clickHex(page, mover.position);
  await waitIdle(page);

  expect(await page.evaluate(() => window.__heraklios.boardView())).toBe('standard');
  expect(await page.evaluate(() => window.__heraklios.hudStrays()), 'Standard view').toEqual([]);

  await clickButton(page, DRAWN);
  await page.waitForFunction(() => window.__heraklios.boardView() === 'drawn');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await page.evaluate(() => window.__heraklios.hudStrays()), 'Drawn view').toEqual([]);
  expect(errors).toEqual([]);
});
