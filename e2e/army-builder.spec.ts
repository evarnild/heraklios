// §51: the army builder's `«` (clear a type) and `»` (fill a type up to what
// the budget and its maximum allow), by canvas clicks only.
//
// Route: Menu "2" -> player 0's army builder. Rows follow UNIT_TYPES order,
// so the button at index 0 belongs to the first type (archers, 5 pt, max 10);
// the scenario checks that through the hook's counts rather than assuming it.
import { expect, test, type Page } from '@playwright/test';
import { UNIT_TYPES } from '../src/data/units';
import { en } from '../src/ui/i18n/en';
import { fr } from '../src/ui/i18n/fr';
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

// §79: the rows sit in two columns of seven, in reading order, with every
// control on the canvas, in both languages.
for (const [lang, text] of [
  ['en', en],
  ['fr', fr],
] as const) {
  test(`the army builder's two columns keep every control on the canvas (${lang})`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript((l) => localStorage.setItem('heraklios.language', l), lang);
    await page.goto('/');
    await page.waitForFunction(() => window.__heraklios?.buttonCount('2') === 1);
    await clickButton(page, '2');
    const useDefault = text.builder.useDefault;
    const confirm = text.builder.confirm;
    await page.waitForFunction((label) => window.__heraklios.buttonCount(label) === 1, useDefault);

    const rows = UNIT_TYPES.length;
    for (const label of ['«', '-', '+', '»']) {
      expect(await page.evaluate((l) => window.__heraklios.buttonCount(l), label), label).toBe(rows);
    }
    const at = (label: string, index: number) =>
      page.evaluate(([l, i]) => window.__heraklios.buttonToCanvas(l as string, i as number), [label, index] as const);
    for (let r = 0; r < rows / 2; r++) {
      const left = await at('«', 2 * r);
      const right = await at('«', 2 * r + 1);
      expect(right.y, `row ${r} shares a y`).toBe(left.y);
      expect(right.x, `row ${r} right column`).toBeGreaterThan((await at('»', 2 * r)).x);
      if (r > 0) expect(left.y, `row ${r} below row ${r - 1}`).toBeGreaterThan((await at('«', 2 * r - 2)).y);
    }
    expect(await page.evaluate((l) => window.__heraklios.buttonCount(l), useDefault)).toBe(1);
    expect(await page.evaluate((l) => window.__heraklios.buttonCount(l), confirm)).toBe(1);
    const confirmY = (await at(confirm, 0)).y;
    for (let i = 0; i < rows; i++) expect(confirmY).toBeGreaterThan((await at('»', i)).y);

    await clickButton(page, '+', 13);
    const b = await builder(page);
    expect(b.counts.quintiremes).toBe(1);
    for (const unit of UNIT_TYPES) if (unit.id !== 'quintiremes') expect(b.counts[unit.id] ?? 0, unit.id).toBe(0);
    expect(errors).toEqual([]);
  });
}
