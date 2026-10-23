// §51: the army builder's `«` (clear a type) and `»` (fill a type up to what
// the budget and its maximum allow), by canvas clicks only.
//
// Route: Menu "2" -> player 0's army builder. Rows follow UNIT_TYPES order,
// so the button at index 0 belongs to the first type (archers, 5 pt, max 10);
// the scenario checks that through the hook's counts rather than assuming it.
import { expect, test, type Page } from '@playwright/test';
import { UNIT_TYPES } from '../src/data/units';
import { clickButton, collectErrors } from './helpers';

const builder = (page: Page) => page.evaluate(() => window.__heraklios.armyBuilder());

test('the « and » buttons clear and fill a unit type, and dim when they would change nothing', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('heraklios.language', 'en'));
  await page.goto('/');
  await page.waitForFunction(() => window.__heraklios?.buttonCount('2') === 1);
  await clickButton(page, '2');
  await page.waitForFunction(() => window.__heraklios.buttonCount('Use default army') === 1);

  const rows = UNIT_TYPES.length;
  const first = UNIT_TYPES[0]!;
  expect(first.id).toBe('archers');
  expect(await page.evaluate(() => window.__heraklios.buttonCount('«'))).toBe(rows);
  expect(await page.evaluate(() => window.__heraklios.buttonCount('»'))).toBe(rows);

  // Empty selection: every « is dimmed, no » is.
  let b = await builder(page);
  expect(b.total).toBe(0);
  for (const unit of UNIT_TYPES) expect(b.dimmed[unit.id], unit.id).toEqual({ clear: true, fill: false });

  // » on archers fills to the cap of 10 (50 pt), not to what 400 pt would buy.
  await clickButton(page, '»', 0);
  b = await builder(page);
  expect(b.counts[first.id]).toBe(10);
  expect(b.total).toBe(50);
  expect(b.dimmed[first.id]).toEqual({ clear: false, fill: true });

  // A second row, while archers hold 10: » and « change only their own type.
  const other = UNIT_TYPES[3]!; // fantassins-lourds, 10 pt, max 8
  expect(other.id).toBe('fantassins-lourds');
  const only = (held: Record<string, number>) => ({ ...Object.fromEntries(UNIT_TYPES.map((u) => [u.id, 0])), ...held });
  await clickButton(page, '»', 3);
  b = await builder(page);
  expect(b.counts).toEqual(only({ [first.id]: 10, [other.id]: 8 }));
  expect(b.total).toBe(130);
  await clickButton(page, '«', 3);
  b = await builder(page);
  expect(b.counts).toEqual(only({ [first.id]: 10 }));
  expect(b.total).toBe(50);

  // « on archers clears them and dims « again.
  await clickButton(page, '«', 0);
  b = await builder(page);
  expect(b.counts[first.id]).toBe(0);
  expect(b.total).toBe(0);
  expect(b.dimmed[first.id]!.clear).toBe(true);

  // With the default army (400 pt spent) every » is dimmed and a click changes nothing.
  await clickButton(page, 'Use default army');
  const army = await builder(page);
  expect(army.total).toBe(400);
  for (const unit of UNIT_TYPES) expect(army.dimmed[unit.id]!.fill, unit.id).toBe(true);
  await clickButton(page, '»', 0);
  await clickButton(page, '»', 3);
  expect((await builder(page)).counts).toEqual(army.counts);

  expect(errors).toEqual([]);
});
