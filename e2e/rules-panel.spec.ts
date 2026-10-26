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
  startFromMenu,
  state,
  waitIdle,
  type Hex,
} from './helpers';

const en = messagesFor('en');

const panel = (page: Page) => page.evaluate(() => window.__heraklios.rulesPanel());
const attackLines = (page: Page) =>
  page.evaluate(() => window.__heraklios.logEntries().filter((e) => e.text.startsWith('Attack')).length);

/** Clicks `hex` with the camera shifted so the hex sits left of the panel, not under it. */
async function clickHexClearOfPanel(page: Page, hex: Hex): Promise<void> {
  await page.evaluate((h) => window.__heraklios.centerOn({ q: h.q + 9, r: h.r }), hex);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const pt = await page.evaluate((h) => window.__heraklios.hexToCanvas(h), hex);
  expect(pt, 'hex on screen').not.toBeNull();
  expect(pt!.x, 'clear of the panel (left edge 508)').toBeLessThan(500);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + pt!.x, box.y + pt!.y);
}

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

  // Build an attack with the panel open.
  await clickButton(page, 'End phase');
  await waitIdle(page);
  const st = await state(page);
  expect(st.phase).toBe('combat');
  const me = st.seatOrder[st.activePlayerIndex];
  const archers = await activeUnitOfType(page, 'archers');
  const target = st.units.find((u) => u.owner !== me && !u.destroyed && hexDistance(archers.position, u.position) === 2)!;
  expect(target).toBeTruthy();
  const lines = await attackLines(page);

  await clickHexClearOfPanel(page, archers.position);
  await page.waitForFunction((n) => window.__heraklios.logEntries().filter((e) => e.text.startsWith('Attack')).length > n, lines);
  expect((await panel(page)).highlight, 'attackers alone: nothing to highlight yet').toBeNull();

  await clickHexClearOfPanel(page, target.position);
  await page.waitForFunction(() => window.__heraklios.rulesPanel().highlight !== null);
  const expected = landCombatHighlight(previewLandAttack([archers], [target]));
  expect(expected).not.toBeNull();
  expect((await panel(page)).highlight).toEqual(expected);

  // Remove the target: the highlight clears.
  await clickHexClearOfPanel(page, target.position);
  await page.waitForFunction(() => window.__heraklios.rulesPanel().highlight === null);

  // A click on the panel (the attacker's hex centred under it) does not reach the map.
  await page.evaluate((h) => window.__heraklios.centerOn(h), archers.position);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const under = (await page.evaluate((h) => window.__heraklios.hexToCanvas(h), archers.position))!;
  expect(under.x, 'the hex is under the panel').toBeGreaterThan(520);
  const before = await attackLines(page);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + under.x, box.y + under.y);
  await waitIdle(page);
  expect(await attackLines(page), 'nothing selected through the panel').toBe(before);
  expect((await panel(page)).open).toBe(true);

  await page.keyboard.press('Escape');
  expect((await panel(page)).open).toBe(false);
  expect(errors).toEqual([]);
});
