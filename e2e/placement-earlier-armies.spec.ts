// §76: a seat's Placement shows the armies the earlier seats placed (dimmed),
// in both views. They can't be placed on, clicked or undone away, and the
// hover tooltip agrees with what is drawn. Whether the dim itself is drawn is
// proved by the live check (no hook reads alpha), not here.
//
// Route: Menu "2" -> default army + "Confirm army" for each seat -> seat 0
// places two land units and presses "Done placing" -> seat 1's Placement.
import { expect, test, type Page } from '@playwright/test';
import { getUnitType } from '../src/data/units';
import { hexDistance } from '../src/engine/hex';
import { en } from '../src/ui/i18n/en';
import { clickButton, clickHex, collectErrors, expectDrawnObjects, hoverHex, key, state, type Hex } from './helpers';

const DRAWN = '🗺 Drawn view';

const unitCount = async (page: Page) => (await state(page)).units.length;

async function placeLandUnit(page: Page): Promise<void> {
  const before = await unitCount(page);
  const { current, legalHexes } = await page.evaluate(() => window.__heraklios.placement());
  expect(current && getUnitType(current).domain, 'the current item is a land unit').toBe('land');
  const taken = new Set((await state(page)).units.map((u) => key(u.position)));
  await clickHex(page, legalHexes.find((h) => !taken.has(key(h)))!);
  await page.waitForFunction((n) => (window.__heraklios.state() as { units: unknown[] }).units.length === n + 1, before);
}

test('Placement shows the earlier seat\'s army and keeps it through undo and redo', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('heraklios.language', 'en'));
  await page.goto('/');
  await page.waitForFunction(() => window.__heraklios?.buttonCount('2') === 1);
  await clickButton(page, '2');
  for (let seat = 0; seat < 2; seat++) {
    await page.waitForFunction(() => window.__heraklios.buttonCount('Use default army') === 1);
    await clickButton(page, 'Use default army');
    await clickButton(page, 'Confirm army');
  }
  await page.waitForFunction(() => window.__heraklios.scenes().includes('Placement'));
  await page.waitForFunction(() => window.__heraklios.state() !== null);

  await placeLandUnit(page);
  await placeLandUnit(page);
  const seat0Legal = JSON.stringify((await page.evaluate(() => window.__heraklios.placement())).legalHexes);
  await clickButton(page, 'Done placing');
  await page.waitForFunction((was) => JSON.stringify(window.__heraklios.placement().legalHexes) !== was, seat0Legal);

  const seat0 = (await state(page)).units.filter((u) => u.owner === 0);
  expect(seat0).toHaveLength(2);
  // Drawn view counts figures (the Standard view's markers have no reader): both seat-0 units are
  // drawn from seat 1's first frame, before any click in this Placement.
  await clickButton(page, DRAWN);
  await page.waitForFunction(() => window.__heraklios.boardView() === 'drawn');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await expectDrawnObjects(page, "Drawn view, seat 1's Placement opens");
  const { legalHexes } = await page.evaluate(() => window.__heraklios.placement());
  for (const u of seat0) {
    // A regression guard: the legal-hex code is unchanged, the gap keeps this band clear.
    expect(legalHexes.some((h: Hex) => hexDistance(h, u.position) <= 3), 'no legal hex within 3 of a seat-0 unit').toBe(false);
  }

  const target = seat0[0]!;
  await clickHex(page, target.position);
  expect(await unitCount(page), 'a click on an earlier unit places nothing').toBe(2);

  await hoverHex(page, target.position);
  const first = `(${target.position.q}, ${target.position.r}) — `;
  await page.waitForFunction((f) => (window.__heraklios.tooltipText() ?? '').startsWith(f), first);
  const lines = (await page.evaluate(() => window.__heraklios.tooltipText()))!.split('\n');
  const owner = (await state(page)).players[0]!;
  expect(lines, 'hex, name/owner/colour and values lines, no state line').toHaveLength(3);
  expect(lines[1]).toBe(`${en.units[target.typeId as keyof typeof en.units]} — ${owner.name} (${en.colors[0]})`);

  for (const u of seat0) {
    expect(await page.evaluate((id) => window.__heraklios.unitCanvas(id), u.id), `seat-0 unit ${u.id} is drawn`).not.toBeNull();
  }

  await placeLandUnit(page);
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => (window.__heraklios.state() as { units: unknown[] }).units.length === 2);
  expect((await state(page)).units.filter((u) => u.owner === 0)).toHaveLength(2);
  expect((await state(page)).units.filter((u) => u.owner === 1)).toHaveLength(0);
  await expectDrawnObjects(page, 'after undo');
  await page.keyboard.press('Control+y');
  await page.waitForFunction(() => (window.__heraklios.state() as { units: unknown[] }).units.length === 3);
  expect((await state(page)).units.filter((u) => u.owner === 1)).toHaveLength(1);
  expect((await state(page)).units.filter((u) => u.owner === 0)).toHaveLength(2);
  await expectDrawnObjects(page, 'after redo');

  expect(errors).toEqual([]);
});
