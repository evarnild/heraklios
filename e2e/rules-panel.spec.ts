// §55: the board's Tables panel. From "Combat test mode": the Tables button
// opens a panel with four tabs, Escape closes it, it opens again on the tab
// last chosen. With it open the board still works: clicks outside the panel
// select units, and the Land combat tab's highlight (read through the hook)
// follows the attack being built — the engine's `landCombatHighlight` of
// `previewLandAttack` for the same units — and clears with the attack. A click
// ON the panel never reaches the map underneath.
import { expect, test, type Page } from '@playwright/test';
import { hexDistance } from '../src/engine/hex';
import { previewLandAttack } from '../src/engine/combat';
import { landCombatHighlight } from '../src/engine/ruleTables';
import { messagesFor } from '../src/ui/i18n/index';
import {
  MENU_CLOSE_COMBAT,
  activeUnitOfType,
  clickButton,
  clickHex,
  settle,
  startFromMenu,
  state,
  waitIdle,
} from './helpers';

const en = messagesFor('en');
/** Rows to scroll the camera so a unit lands in the panel's area. */
const PAN_ROWS = 6;

const panel = (page: Page) => page.evaluate(() => window.__heraklios.rulesPanel());
const attackLines = (page: Page) =>
  page.evaluate(() => window.__heraklios.logEntries().filter((e) => e.text.startsWith('Attack')).length);

const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const canvasBox = async (page: Page) => (await page.locator('canvas').boundingBox())!;

test('the Tables panel: tabs, Escape, a highlight that follows the attack, clicks that stay on the panel', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_CLOSE_COMBAT, 'close-combat', 1);
  const tabs = en.rules.tabs;

  // Open in the movement phase: Terrain effects first, four tabs.
  expect(await panel(page)).toEqual({ open: false, tab: null, highlight: null });
  await clickButton(page, en.board.tables);
  expect(await panel(page)).toMatchObject({ open: true, tab: 'terrain' });
  for (const label of Object.values(tabs)) {
    expect(await page.evaluate((l) => window.__heraklios.buttonCount(l), label), label).toBe(1);
  }
  await clickButton(page, tabs.ramming);
  expect((await panel(page)).tab).toBe('ramming');
  await clickButton(page, tabs.boarding);
  expect((await panel(page)).tab).toBe('boarding');
  await clickButton(page, tabs.terrain);
  expect((await panel(page)).tab).toBe('terrain');
  await clickButton(page, tabs.land);

  // Escape closes; the panel reopens on the last tab chosen.
  await page.keyboard.press('Escape');
  expect((await panel(page)).open).toBe(false);
  await clickButton(page, en.board.tables);
  expect(await panel(page)).toMatchObject({ open: true, tab: 'land', highlight: null });

  // Build an attack with the panel open: the panel sits above the centre, so the board is clickable.
  await clickButton(page, 'End phase');
  await waitIdle(page);
  const st = await state(page);
  expect(st.phase).toBe('combat');
  const me = st.seatOrder[st.activePlayerIndex];
  const archers = await activeUnitOfType(page, 'archers');
  const target = st.units.find((u) => u.owner !== me && !u.destroyed && hexDistance(archers.position, u.position) === 2)!;
  expect(target).toBeTruthy();
  const lines = await attackLines(page);

  await clickHex(page, archers.position);
  await page.waitForFunction((n) => window.__heraklios.logEntries().filter((e) => e.text.startsWith('Attack')).length > n, lines);
  expect((await panel(page)).highlight, 'attackers alone: nothing to highlight yet').toBeNull();

  await clickHex(page, target.position);
  await page.waitForFunction(() => window.__heraklios.rulesPanel().highlight !== null);
  const expected = landCombatHighlight(previewLandAttack([archers], [target]));
  expect(expected).not.toBeNull();
  expect((await panel(page)).highlight).toEqual(expected);

  // Undo takes the target back (the highlight follows the restored selection); redo puts it back.
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => window.__heraklios.rulesPanel().highlight === null);
  await page.keyboard.press('Control+Shift+z');
  await page.waitForFunction(() => window.__heraklios.rulesPanel().highlight !== null);
  expect((await panel(page)).highlight).toEqual(expected);

  // Remove the target: the highlight clears.
  await clickHex(page, target.position);
  await page.waitForFunction(() => window.__heraklios.rulesPanel().highlight === null);

  // A click on the panel (the attacker's hex scrolled up under it) does not reach the map.
  await page.evaluate(([h, rows]) => window.__heraklios.centerOn({ q: h.q, r: h.r + rows }), [archers.position, PAN_ROWS] as const);
  await frames(page);
  const under = (await page.evaluate((h) => window.__heraklios.hexToCanvas(h), archers.position))!;
  expect(under.y, 'the hex is under the panel').toBeLessThan(260);
  expect(under.x, 'the hex is under the panel').toBeGreaterThan(330);
  const before = await attackLines(page);
  const box = await canvasBox(page);
  await page.mouse.click(box.x + under.x, box.y + under.y);
  await waitIdle(page);
  expect(await attackLines(page), 'nothing selected through the panel').toBe(before);
  expect((await panel(page)).open).toBe(true);

  // The wheel over the panel does not zoom the map.
  const zoom = await page.evaluate(() => window.__heraklios.cameraZoom());
  await page.mouse.move(box.x + under.x, box.y + under.y);
  await page.mouse.wheel(0, -300);
  await frames(page);
  expect(await page.evaluate(() => window.__heraklios.cameraZoom())).toBe(zoom);

  // The Tables button closes an open panel.
  await clickButton(page, en.board.tables);
  expect((await panel(page)).open).toBe(false);

  // Resolving the attack clears the highlight: reopen, build it again, resolve.
  await clickButton(page, en.board.tables);
  await clickHex(page, target.position); // the archers are still selected
  await page.waitForFunction(() => window.__heraklios.rulesPanel().highlight !== null);
  await clickButton(page, 'Resolve attack');
  await settle(page);
  expect((await panel(page)).highlight, 'cleared by the resolution').toBeNull();

  await page.keyboard.press('Escape');
  expect((await panel(page)).open).toBe(false);
  expect(errors).toEqual([]);
});
