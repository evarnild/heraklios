// §66, §77: both views animate a move, and the speed setting. The suite's
// other scenarios run with animations Off (playwright.config.ts); this one
// sets its own speed. A unit slides through intermediate positions, any click
// finishes the animation before it acts, an undo snaps, the speed button
// cycles in both views and is remembered across a reload, and at Off the
// Standard view starts no tween.
import { expect, test, type Page } from '@playwright/test';
import { MENU_TEST, chord, clickButton, clickHex, key, reachable, startFromMenu, state, unit, waitIdle, type Hex } from './helpers';

const DRAWN = '🗺 Drawn view';
const STANDARD = '🗺 Standard view';
const VIEWS = ['standard', 'drawn'] as const;
const LABEL = { normal: '⏩ Speed: Normal', slow: '⏩ Speed: Slow', off: '⏩ Speed: Off' } as const;

const hexDistance = (a: Hex, b: Hex) => (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
const apart = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** An own unit with a reachable hex at least `min` hexes away: [unit id, from, to]. */
async function longMove(page: Page, skip: string[] = [], min = 3): Promise<{ id: string; from: Hex; to: Hex }> {
  const st = await state(page);
  const pid = st.seatOrder[st.activePlayerIndex];
  for (const u of st.units.filter((x) => x.owner === pid && !x.destroyed && !skip.includes(x.id))) {
    const reach = await reachable(page, u.id);
    const to = reach.map((k) => ({ q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) })).find((h) => hexDistance(u.position, h) >= min);
    if (to) return { id: u.id, from: u.position, to };
  }
  throw new Error('No own unit has a reachable hex 3+ hexes away');
}

async function toDrawn(page: Page): Promise<void> {
  await clickButton(page, DRAWN);
  await page.waitForFunction(() => window.__heraklios.boardView() === 'drawn');
}

async function toStandard(page: Page): Promise<void> {
  await clickButton(page, STANDARD);
  await page.waitForFunction(() => window.__heraklios.boardView() === 'standard');
}

/** The Board starts in the Standard view: go to `view` (a no-op for the Standard view). */
async function inView(page: Page, view: (typeof VIEWS)[number]): Promise<void> {
  expect(await page.evaluate(() => window.__heraklios.boardView())).toBe('standard');
  if (view === 'drawn') await toDrawn(page);
}

const at = (page: Page, id: string) => page.evaluate((i) => window.__heraklios.unitCanvas(i), id);
const hexAt = (page: Page, h: Hex) => page.evaluate((x) => window.__heraklios.hexToCanvas(x), h);

test.describe('at Normal speed', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const view of VIEWS) {
    test(`a land move slides through intermediate positions and ends on the clicked hex (${view} view)`, async ({ page }) => {
      const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
      expect(await page.evaluate(() => window.__heraklios.animationSpeed())).toBe('normal');
      await inView(page, view);
      const m = await longMove(page);

      await clickHex(page, m.from);
      await clickHex(page, m.to);
      await page.waitForFunction(() => !window.__heraklios.idle(), undefined, { polling: 'raf', timeout: 3000 });
      const start = (await hexAt(page, m.from))!;
      const end = (await hexAt(page, m.to))!;
      const samples: Array<{ x: number; y: number }> = [];
      while (!(await page.evaluate(() => window.__heraklios.idle()))) {
        const p = await at(page, m.id);
        if (p) samples.push(p);
        await page.waitForTimeout(20);
      }
      expect(samples.some((p) => apart(p, start) > 12 && apart(p, end) > 12), 'an intermediate position was drawn').toBe(true);
      expect(apart((await at(page, m.id))!, end)).toBeLessThan(1.5);
      expect((await unit(page, m.id)).position).toEqual(m.to);
      expect(errors).toEqual([]);
    });
  }

  test('the speed button is in both views, steps Normal, Slow, Off there and is remembered across a reload', async ({ page }) => {
    const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
    const count = (label: string) => page.evaluate((l) => window.__heraklios.buttonCount(l), label);
    expect(await count(LABEL.normal), 'the speed button is in the Standard view').toBe(1);
    for (const [shown, next] of [['normal', 'slow'], ['slow', 'off'], ['off', 'normal'], ['normal', 'slow']] as const) {
      await clickButton(page, LABEL[shown]);
      await page.waitForFunction((l) => window.__heraklios.buttonCount(l) === 1, LABEL[next]);
      expect(await page.evaluate(() => window.__heraklios.animationSpeed())).toBe(next);
    }
    await toDrawn(page);
    expect(await count(LABEL.slow), 'still shown, same label, in the Drawn view').toBe(1);
    await toStandard(page);
    expect(await count(LABEL.slow), 'and back in the Standard view').toBe(1);

    await page.reload();
    await page.waitForFunction(() => window.__heraklios?.scenes().length > 0);
    expect(await page.evaluate(() => window.__heraklios.animationSpeed())).toBe('slow');
    expect(errors).toEqual([]);
  });
});

test.describe('at Off speed', () => {
  test.use({
    storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:5232', localStorage: [{ name: 'heraklios.animationSpeed', value: 'off' }] }] },
  });

  test('the Standard view starts no tween on a move', async ({ page }) => {
    const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
    expect(await page.evaluate(() => window.__heraklios.boardView())).toBe('standard');
    expect(await page.evaluate(() => window.__heraklios.animationSpeed())).toBe('off');
    const m = await longMove(page);
    await clickHex(page, m.from);
    await clickHex(page, m.to);
    await waitIdle(page);
    for (let i = 0; i < 10; i++) {
      expect(await page.evaluate(() => window.__heraklios.busy()), 'nothing animates').toEqual([]);
      await page.waitForTimeout(40);
    }
    expect(apart((await at(page, m.id))!, (await hexAt(page, m.to))!), 'at its destination').toBeLessThan(1.5);
    expect((await unit(page, m.id)).position).toEqual(m.to);
    expect(errors).toEqual([]);
  });
});

test.describe('at Slow speed', () => {
  test.use({
    storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:5232', localStorage: [{ name: 'heraklios.animationSpeed', value: 'slow' }] }] },
  });

  for (const view of VIEWS) {
    test(`a click during a move finishes it at once and then acts (${view} view)`, async ({ page }) => {
      const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
      await inView(page, view);
      const mover = await longMove(page);
      const other = await longMove(page, [mover.id], 1);

      await clickHex(page, mover.from);
      await clickHex(page, mover.to);
      await page.waitForFunction(() => !window.__heraklios.idle(), undefined, { polling: 'raf', timeout: 3000 });
      const mid = (await at(page, mover.id))!;
      expect(apart(mid, (await hexAt(page, mover.to))!), 'still on its way').toBeGreaterThan(12);

      // The click lands on another own unit: the move finishes first, then the click selects it.
      await clickHex(page, other.from);
      await page.waitForFunction((id) => window.__heraklios.selectedUnitId() === id, other.id);
      expect(apart((await at(page, mover.id))!, (await hexAt(page, mover.to))!), 'finished at once').toBeLessThan(1.5);
      await waitIdle(page);
      expect((await unit(page, mover.id)).position).toEqual(mover.to);
      expect(key((await unit(page, other.id)).position)).toBe(key(other.from));
      expect(errors).toEqual([]);
    });
  }

  test('an undo during a move snaps the unit back to its start hex (Standard view)', async ({ page }) => {
    const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
    expect(await page.evaluate(() => window.__heraklios.boardView())).toBe('standard');
    const m = await longMove(page);
    await clickHex(page, m.from);
    await clickHex(page, m.to);
    await page.waitForFunction(() => !window.__heraklios.idle(), undefined, { polling: 'raf', timeout: 3000 });

    await chord(page, ['Control'], 'z');
    await page.waitForFunction((id) => window.__heraklios.unitCanvas(id) !== null, m.id);
    for (let i = 0; i < 10; i++) {
      expect(await page.evaluate(() => window.__heraklios.busy()), 'nothing animates after the undo').toEqual([]);
      await page.waitForTimeout(40);
    }
    expect(apart((await at(page, m.id))!, (await hexAt(page, m.from))!), 'drawn on its start hex').toBeLessThan(1.5);
    expect((await unit(page, m.id)).position).toEqual(m.from);
    expect(errors).toEqual([]);
  });
});
