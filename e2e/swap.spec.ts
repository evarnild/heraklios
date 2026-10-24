// §54: two adjacent friendly land units swap places. From "Combat test mode"
// (the active player's land units stand side by side on the r=3 row): with
// the option on (the default), selecting one highlights its neighbour and
// clicking the neighbour trades their places, with a log line, and Undo
// puts both back. With "Unit swaps" turned off on the Menu, the same click
// selects the other unit instead.
import { expect, test } from '@playwright/test';
import { MENU_CLOSE_COMBAT, clickButton, clickHex, collectErrors, state, unit, waitIdle } from './helpers';

type Hex = { q: number; r: number };

/**
 * A small screenshot inside hex `b`'s edge, away from the unit marker on its
 * centre and well inside the hex: `b` is a neighbour of `a`, so the hex-to-hex
 * spacing gives the scale. Only a swap highlight (or nothing) paints it: `b`
 * is occupied, so it is never a reachable hex.
 */
async function edgeShot(page: import('@playwright/test').Page, a: Hex, b: Hex): Promise<Buffer> {
  await page.evaluate((h) => window.__heraklios.centerOn(h), b);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const [pa, pb] = await page.evaluate(([x, y]) => [window.__heraklios.hexToCanvas(x), window.__heraklios.hexToCanvas(y)], [a, b] as const);
  const box = await page.locator('canvas').boundingBox();
  if (!pa || !pb || !box) throw new Error('hex or canvas not on screen');
  const spacing = Math.hypot(pb.x - pa.x, pb.y - pa.y);
  const dx = ((pb.x - pa.x) / spacing) * spacing * 0.38; // toward the far side of b, away from a
  const dy = ((pb.y - pa.y) / spacing) * spacing * 0.38;
  return page.screenshot({ clip: { x: box.x + pb.x + dx - 2, y: box.y + pb.y + dy - 2, width: 4, height: 4 } });
}

async function openCloseCombat(page: import('@playwright/test').Page, swapsOff: boolean): Promise<string[]> {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('heraklios.language', 'en'));
  await page.goto('/');
  await page.waitForFunction(() => window.__heraklios?.buttonCount('Unit swaps: on') === 1);
  if (swapsOff) {
    await clickButton(page, 'Unit swaps: on');
    await page.waitForFunction(() => window.__heraklios.buttonCount('Unit swaps: off') === 1);
  }
  await page.evaluate((n) => window.__heraklios.seed(n), 1);
  await clickButton(page, MENU_CLOSE_COMBAT);
  await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  await waitIdle(page);
  return errors;
}

async function neighbours(page: import('@playwright/test').Page) {
  const st = await state(page);
  const mine = (q: number) => st.units.find((u) => u.owner === st.seatOrder[st.activePlayerIndex] && u.position.q === q && u.position.r === 3)!;
  return { a: mine(10), b: mine(11) };
}

test('an adjacent friend is highlighted, a click swaps, Undo restores (swaps on by default)', async ({ page }) => {
  const errors = await openCloseCombat(page, false);
  const { a, b } = await neighbours(page);
  expect(await page.evaluate((id) => window.__heraklios.swappable(id), a.id)).toContain(b.id);

  const before = await edgeShot(page, a.position, b.position);
  await clickHex(page, a.position);
  expect((await edgeShot(page, a.position, b.position)).equals(before), 'the swap partner is highlighted').toBe(false);

  await clickHex(page, b.position);
  await waitIdle(page);
  expect((await unit(page, a.id)).position).toEqual(b.position);
  expect((await unit(page, b.id)).position).toEqual(a.position);
  expect((await unit(page, a.id)).movementLeft).toBe(a.movementLeft - 1);

  const entries = await page.evaluate(() => window.__heraklios.logEntries());
  const line = entries.map((e) => e.text).find((t) => t.endsWith(' swap places.'));
  expect(line, 'the log says they swap').toBeTruthy();
  const names = line!.replace(' swap places.', '');
  await clickButton(page, `↶ Undo: Swap ${names}`);
  await waitIdle(page);
  expect((await unit(page, a.id)).position).toEqual(a.position);
  expect((await unit(page, b.id)).position).toEqual(b.position);
  expect((await unit(page, a.id)).movementLeft).toBe(a.movementLeft);
  expect(errors).toEqual([]);
});

test('with Unit swaps off, clicking the friend selects it instead', async ({ page }) => {
  const errors = await openCloseCombat(page, true);
  const { a, b } = await neighbours(page);
  expect((await state(page)).allowSwaps).toBe(false);
  expect(await page.evaluate((id) => window.__heraklios.swappable(id), a.id)).toEqual([]);

  const before = await edgeShot(page, a.position, b.position);
  await clickHex(page, a.position);
  expect((await edgeShot(page, a.position, b.position)).equals(before), 'nothing is highlighted on the friend').toBe(true);
  await clickHex(page, b.position);
  await waitIdle(page);
  expect((await unit(page, a.id)).position).toEqual(a.position);
  expect((await unit(page, b.id)).position).toEqual(b.position);
  expect((await page.evaluate(() => window.__heraklios.logEntries())).some((e) => e.text.endsWith(' swap places.'))).toBe(false);
  expect(errors).toEqual([]);
});
