// §40: on the Placement screen the left Turn button turns the ship being
// placed counter-clockwise on screen (facing +1) and the right one clockwise
// (facing -1), by canvas clicks only (see naval.spec.ts and hexToPixel for
// why a higher facing index is counter-clockwise).
//
// Route: Menu "2" -> seat 0 buys a small, ship-heavy army through the `»`
// fills (see the "build armies" step) and seat 1 takes the default army,
// each with "Confirm army" -> player 0's Placement. The queue follows UNIT_TYPES order, so the scenario reads
// the current item from the hook rather than assuming land or ships come
// first: it clicks the first free legal hex for every land unit until the
// current item is a ship, then places two ships, one per Turn button.
import { expect, test, type Page } from '@playwright/test';
import { UNIT_TYPES, getUnitType } from '../src/data/units';
import { clickButton, clickHex, collectErrors, key, state, type Hex } from './helpers';

async function unitCount(page: Page): Promise<number> {
  return ((await state(page))?.units.length ?? 0);
}

async function freeLegalHex(page: Page): Promise<Hex> {
  const { legalHexes } = await page.evaluate(() => window.__heraklios.placement());
  const taken = new Set((await state(page)).units.map((u) => key(u.position)));
  const hex = legalHexes.find((h) => !taken.has(key(h)));
  expect(hex, 'a free legal hex to place on').toBeTruthy();
  return hex!;
}

/** Stages a ship on a free sea hex, clicks Turn button `turn` (0 left, 1 right), confirms; returns the new unit. */
async function placeShip(page: Page, turn: 0 | 1) {
  const before = await unitCount(page);
  const { current } = await page.evaluate(() => window.__heraklios.placement());
  expect(current && getUnitType(current).domain, 'the current item is a ship').toBe('naval');
  await clickHex(page, await freeLegalHex(page));
  await clickButton(page, 'Turn', turn);
  await clickButton(page, 'Confirm facing');
  await page.waitForFunction((n) => (window.__heraklios.state() as { units: unknown[] }).units.length === n + 1, before);
  return (await state(page)).units.at(-1)!;
}

test('the Turn buttons turn a ship being placed the way they sit', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('heraklios.language', 'en'));
  await page.goto('/');
  await page.waitForFunction(() => window.__heraklios?.buttonCount('2') === 1);
  await clickButton(page, '2');
  await test.step('build armies', async () => {
    // §89: seat 0 buys a small, ship-heavy army instead of the default one, so
    // the land loop below places 8 units, not 43. Measured before the change,
    // that loop took 17-31 s of the 30 s test timeout (playwright.config.ts)
    // and every click costs more on a busy machine. `»` fills a row to its
    // cap or to what the budget allows (§51); rows are addressed by
    // UNIT_TYPES index, as army-builder.spec.ts does. Fills in order:
    // quintiremes 1, triremes 3, biremes 5, galeres 6 (300 pt), phalanges 5
    // (375), elephants 2 (395), archers 1 (400): 8 land units, 15 ships.
    await page.waitForFunction(() => window.__heraklios.buttonCount('»') > 0);
    for (const id of ['quintiremes', 'triremes', 'biremes', 'galeres', 'phalanges', 'elephants', 'archers']) {
      await clickButton(page, '»', UNIT_TYPES.findIndex((u) => u.id === id));
    }
    expect((await page.evaluate(() => window.__heraklios.armyBuilder())).total, 'the small army costs exactly 400').toBe(400);
    await clickButton(page, 'Confirm army');
    // Seat 1 keeps the default army: its placement is never reached.
    await page.waitForFunction(() => window.__heraklios.buttonCount('Use default army') === 1);
    await clickButton(page, 'Use default army');
    await clickButton(page, 'Confirm army');
    await page.waitForFunction(() => window.__heraklios.scenes().includes('Placement'));
    await page.waitForFunction(() => window.__heraklios.state() !== null);
  });

  await test.step('place land units', async () => {
    for (let guard = 0; guard < 200; guard++) {
      const { current } = await page.evaluate(() => window.__heraklios.placement());
      if (!current || getUnitType(current).domain === 'naval') break;
      const before = await unitCount(page);
      await clickHex(page, await freeLegalHex(page));
      await page.waitForFunction((n) => (window.__heraklios.state() as { units: unknown[] }).units.length === n + 1, before);
    }
  });

  await test.step('place ships', async () => {
    const left = await placeShip(page, 0);
    expect(left.facing, 'left Turn turns the new ship counter-clockwise').toBe(1);
    const right = await placeShip(page, 1);
    expect(right.facing, 'right Turn turns the new ship clockwise').toBe(5);
  });
  expect(errors).toEqual([]);
});
