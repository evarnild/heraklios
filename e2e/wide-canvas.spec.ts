// §88: the canvas takes the window's width when the game starts (never under
// 1100). At 1600 x 750 the Board's main camera is 1300 wide (1600 minus the
// 300-px side panel), so its centre is x 950, and the right-edge panels keep
// their offsets from the new right edge. The army builder's own layout is
// proved by armyBuilderLayout.test.ts.
import { expect, test } from '@playwright/test';
import { messagesFor } from '../src/ui/i18n/index';
import { RULES_PANEL_W, SIDE_PANEL_WIDTH } from '../src/ui/rulesPanelLayout';
import { scorePanelRect } from '../src/ui/scorePanelLayout';
import { MENU_TEST, clickButton, collectErrors, startFromMenu, state } from './helpers';

const en = messagesFor('en');
const WIDE = 1600;
const TABLES_MARGIN = 12; // rulesPanelLayout.ts MARGIN (not exported)

test.use({ viewport: { width: WIDE, height: 750 } });

test('a 1600-wide window gives a 1600-wide canvas, a wider map view and right-edge panels', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);

  expect((await page.locator('canvas').boundingBox())!.width).toBe(WIDE);
  expect(await page.evaluate(() => window.__heraklios.viewCentre())).toMatchObject({ x: SIDE_PANEL_WIDTH + (WIDE - SIDE_PANEL_WIDTH) / 2 });

  const panel = await page.evaluate(() => window.__heraklios.scorePanel());
  const expected = scorePanelRect(WIDE, 750, (await state(page)).players.length);
  expect(panel.rect.left).toBe(expected.left);
  expect(panel.rect.left + panel.rect.width, 'the score panel hugs the new right edge').toBeGreaterThan(WIDE - 20);

  await clickButton(page, en.board.tables);
  await page.waitForFunction(() => window.__heraklios.rulesPanel().open);
  expect((await page.evaluate(() => window.__heraklios.rulesPanel())).left).toBe(WIDE - RULES_PANEL_W - TABLES_MARGIN);

  expect(errors).toEqual([]);
});

test('from the Menu a 1600-wide window opens the army builder', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('heraklios.language', 'en'));
  await page.goto('/');
  await page.waitForFunction(() => window.__heraklios?.buttonCount('2') === 1);
  expect((await page.locator('canvas').boundingBox())!.width).toBe(WIDE);
  await clickButton(page, '2');
  await page.waitForFunction(() => window.__heraklios.buttonCount('Use default army') === 1);
  expect(errors).toEqual([]);
});
