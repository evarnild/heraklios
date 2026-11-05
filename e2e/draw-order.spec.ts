// §65: after counters move (a swap, then Undo) the markers are re-stacked in
// the display list. The list must still be depth-sorted, or the depth-10
// counters draw over the rings, facings and labels at depths 11-13.
import { expect, test } from '@playwright/test';
import { MENU_CLOSE_COMBAT, clickButton, clickHex, collectErrors, state, waitIdle } from './helpers';

const frames = (page: import('@playwright/test').Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test('the display list stays depth-sorted after a swap and Undo', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('heraklios.language', 'en'));
  await page.goto('/');
  await page.waitForFunction(() => window.__heraklios?.buttonCount('Unit swaps: on') === 1);
  await page.evaluate((n) => window.__heraklios.seed(n), 1);
  await clickButton(page, MENU_CLOSE_COMBAT);
  await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  await waitIdle(page);
  await frames(page);
  expect(await page.evaluate(() => window.__heraklios.displayListSorted()), 'sorted at the start').toBe(true);

  const st = await state(page);
  const mine = (q: number) => st.units.find((u) => u.owner === st.seatOrder[st.activePlayerIndex] && u.position.q === q && u.position.r === 3)!;
  const a = mine(10);
  const b = mine(11);
  await clickHex(page, a.position);
  await clickHex(page, b.position);
  await waitIdle(page);
  await frames(page);
  expect(await page.evaluate(() => window.__heraklios.displayListSorted()), 'sorted after the swap').toBe(true);

  const entries = await page.evaluate(() => window.__heraklios.logEntries());
  const line = entries.map((e) => e.text).find((t) => t.endsWith(' swap places.'))!;
  await clickButton(page, `↶ Undo: Swap ${line.replace(' swap places.', '')}`);
  await waitIdle(page);
  await frames(page);
  expect(await page.evaluate(() => window.__heraklios.displayListSorted()), 'sorted after Undo').toBe(true);
  expect(errors).toEqual([]);
});
