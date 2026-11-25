// §82: every unit carries a phase marker (not moved / partly moved / done,
// can attack / has attacked / been attacked, and a cavalry charge), drawn on
// its own figure in both views. Read through `window.__heraklios.unitMarks()`,
// which reports the status each view was last told to show and where the mark
// and its counter are drawn. The expected readings are the engine's own
// `unitStatuses` run on the state copy, plus explicit values for the cases
// the rules fix (the attacker's tick, the defender's cross). The look itself
// (AC13) is the owner's live check.
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { unitType } from '../src/engine/state';
import { unitStatuses } from '../src/engine/unitStatus';
import {
  MENU_CLOSE_COMBAT,
  MENU_TEST,
  activeUnitOfType,
  chord,
  clickButton,
  clickHex,
  endPhase,
  frames,
  loadOnSameRowAs,
  reachable,
  settle,
  startFromMenu,
  state,
  unit,
  waitIdle,
  waitLoadOnRowOf,
  waitSavePanelLoaded,
  type Hex,
} from './helpers';
import { SAVES_DIR, acquireSaveLock, withSaveLockHeld } from './savesDir';

const DRAWN = '🗺 Drawn view';
const STANDARD = '🗺 Standard view';
const SLOT_1_FILE = join(SAVES_DIR, 'slot-1.json');

type Reading = Record<string, { activity?: string; charged?: true }>;

/** What the board shows now: each unit that has a status or a charge. */
async function shown(page: Page): Promise<Reading> {
  const marks = await page.evaluate(() => window.__heraklios.unitMarks());
  const out: Reading = {};
  for (const [id, m] of Object.entries(marks)) {
    if (m.status === undefined && !m.charged) continue;
    out[id] = { ...(m.status === undefined ? {} : { activity: m.status }), ...(m.charged ? { charged: true as const } : {}) };
  }
  return out;
}

/** What the engine says for the state the page holds. */
async function expected(page: Page, attacked: string[] = []): Promise<Reading> {
  const st = await state(page);
  return Object.fromEntries(unitStatuses(st as never, { attackedThisPhase: new Set(attacked) }));
}

const activity = async (page: Page, id: string) => (await shown(page))[id]?.activity;
const hexDistance = (a: Hex, b: Hex) => (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;

async function toView(page: Page, view: 'standard' | 'drawn'): Promise<void> {
  if ((await page.evaluate(() => window.__heraklios.boardView())) === view) return;
  await clickButton(page, view === 'drawn' ? DRAWN : STANDARD);
  await page.waitForFunction((v) => window.__heraklios.boardView() === v, view);
  await frames(page);
}

/** An own unit with a reachable hex exactly its whole allowance away (a full spend on any terrain), and that hex. */
async function fullSpend(page: Page): Promise<{ id: string; from: Hex; to: Hex }> {
  const st = await state(page);
  const me = st.seatOrder[st.activePlayerIndex];
  for (const u of st.units.filter((x) => x.owner === me && !x.destroyed)) {
    if (unitType(u as never).domain !== 'land') continue;
    const allowance = unitType(u as never).movement;
    const to = (await reachable(page, u.id))
      .map((k) => ({ q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) }))
      .find((h) => hexDistance(u.position, h) === allowance);
    if (to) return { id: u.id, from: u.position, to };
  }
  throw new Error('No own unit can spend its whole allowance');
}

for (const view of ['standard', 'drawn'] as const) {
  test(`movement phase: not moved, partly moved, done, and undo (${view} view)`, async ({ page }) => {
    const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
    await toView(page, view);
    const st = await state(page);
    const me = st.seatOrder[st.activePlayerIndex];
    const start = await shown(page);
    expect(start).toEqual(await expected(page));
    for (const u of st.units.filter((x) => !x.destroyed)) {
      expect(start[u.id]?.activity, u.id).toBe(u.owner === me ? 'notMoved' : undefined);
    }
    expect((await page.evaluate(() => window.__heraklios.hudStrays())).strays).toEqual([]);

    // One hex: partly moved. (An infantry unit, so no charge.)
    const mover = await activeUnitOfType(page, 'fantassins');
    const reach = await reachable(page, mover.id);
    const step = reach.map((k) => ({ q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) })).find((h) => hexDistance(mover.position, h) === 1)!;
    await clickHex(page, mover.position);
    await clickHex(page, step);
    await waitIdle(page);
    expect(await activity(page, mover.id)).toBe('partlyMoved');
    const afterOne = await shown(page);
    expect(afterOne).toEqual(await expected(page));

    // Its whole allowance: done (a cavalry unit's charge shows beside it).
    const full = await fullSpend(page);
    const before = await shown(page);
    await clickHex(page, full.from);
    await clickHex(page, full.to);
    await waitIdle(page);
    expect(await activity(page, full.id)).toBe('done');
    const after = await shown(page);
    expect(after).toEqual(await expected(page));
    if ((await unit(page, full.id)).charged) expect(after[full.id]!.charged).toBe(true);
    expect((await page.evaluate(() => window.__heraklios.hudStrays())).strays).toEqual([]);

    // Ctrl+Z gives the previous reading back.
    await chord(page, ['Control'], 'z');
    await waitIdle(page);
    expect(await shown(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test('combat phase: can attack, has attacked, been attacked, then the next seat (seed 1)', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_CLOSE_COMBAT, 'close-combat', 1);
  const st0 = await state(page);
  const me = st0.seatOrder[st0.activePlayerIndex];
  const archers = await activeUnitOfType(page, 'archers');
  const step = archers.position.r < 4 ? 1 : -1;
  const target = st0.units.find((u) => u.owner !== me && u.position.q === archers.position.q && u.position.r === archers.position.r + 2 * step)!;

  await endPhase(page);
  await waitIdle(page);
  expect((await state(page)).phase).toBe('combat');
  const canAttack = await shown(page);
  expect(canAttack).toEqual(await expected(page));
  expect(canAttack[archers.id]?.activity).toBe('canAttack');
  expect(canAttack[target.id]).toBeUndefined();

  await clickHex(page, archers.position);
  await clickHex(page, target.position);
  await clickButton(page, 'Resolve attack');
  await settle(page);
  expect((await unit(page, target.id)).defendedThisPhase).toBe(true);
  const attacked = await shown(page);
  expect(attacked).toEqual(await expected(page, [archers.id]));
  expect(attacked[archers.id]?.activity).toBe('hasAttacked');
  // The defender shows the red cross unless the roll destroyed it (a destroyed unit is not drawn).
  expect(attacked[target.id]?.activity).toBe((await unit(page, target.id)).destroyed ? undefined : 'beenAttacked');
  expect(Object.values(attacked).filter((s) => s.activity === 'beenAttacked').length).toBeLessThanOrEqual(1);

  await endPhase(page);
  await waitIdle(page);
  const next = await state(page);
  expect(next.phase).toBe('movement');
  expect(next.seatOrder[next.activePlayerIndex]).not.toBe(me);
  const fresh = await shown(page);
  expect(fresh).toEqual(await expected(page));
  expect(fresh[target.id]?.activity).not.toBe('beenAttacked');
  expect(Object.values(fresh).some((s) => s.activity === 'beenAttacked')).toBe(false);
  expect(errors).toEqual([]);
});

test('a view switch keeps the readings, and the marks are in each view (seed 1)', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const mover = await activeUnitOfType(page, 'fantassins');
  const reach = await reachable(page, mover.id);
  const to = reach.map((k) => ({ q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) })).find((h) => hexDistance(mover.position, h) === 1)!;
  await clickHex(page, mover.position);
  await clickHex(page, to);
  await waitIdle(page);
  const standard = await shown(page);
  expect(standard[mover.id]?.activity).toBe('partlyMoved');
  await toView(page, 'drawn');
  expect(await shown(page)).toEqual(standard);
  expect((await page.evaluate(() => window.__heraklios.hudStrays())).strays).toEqual([]);
  await toView(page, 'standard');
  expect(await shown(page)).toEqual(standard);
  expect(errors).toEqual([]);
});

test('a load restores the readings (seed 1)', async ({ page }) => {
  await acquireSaveLock();
  try {
    rmSync(SLOT_1_FILE, { force: true });
    const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
    const mover = await activeUnitOfType(page, 'fantassins');
    const reach = await reachable(page, mover.id);
    const to = reach.map((k) => ({ q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) })).find((h) => hexDistance(mover.position, h) === 1)!;
    await clickHex(page, mover.position);
    await clickHex(page, to);
    await waitIdle(page);
    const saved = await shown(page);

    await clickButton(page, '💾 Save / Load');
    await waitSavePanelLoaded(page);
    const savePoint = await page.evaluate(() => window.__heraklios.buttonToCanvas('Save', 0));
    await clickButton(page, 'Save', 0);
    await waitLoadOnRowOf(page, savePoint);
    await clickButton(page, 'Close');
    await waitIdle(page);
    expect(JSON.parse(readFileSync(SLOT_1_FILE, 'utf8'))).toBeTruthy();

    // Spend another unit's points, then load: the readings go back to the saved ones.
    const other = await fullSpend(page);
    await clickHex(page, other.from);
    await clickHex(page, other.to);
    await waitIdle(page);
    expect(await shown(page)).not.toEqual(saved);
    await clickButton(page, '💾 Save / Load');
    await waitSavePanelLoaded(page);
    await clickButton(page, 'Load', await loadOnSameRowAs(page, savePoint));
    await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
    await waitIdle(page);
    expect(await shown(page)).toEqual(saved);
    expect(errors).toEqual([]);
  } finally {
    await withSaveLockHeld(() => {});
  }
});

test.describe('at Normal speed', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const view of ['standard', 'drawn'] as const) {
    test(`the mark rides its counter through a slide (${view} view)`, async ({ page }) => {
      const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
      expect(await page.evaluate(() => window.__heraklios.animationSpeed())).toBe('normal');
      await toView(page, view);
      const m = await fullSpend(page);
      await clickHex(page, m.from);
      await clickHex(page, m.to);
      await page.waitForFunction(() => !window.__heraklios.idle(), undefined, { polling: 'raf', timeout: 3000 });
      const from = (await page.evaluate((h) => window.__heraklios.hexToCanvas(h), m.from))!;
      let midSlide = 0;
      while (!(await page.evaluate(() => window.__heraklios.idle()))) {
        const mark = (await page.evaluate(() => window.__heraklios.unitMarks()))[m.id];
        if (mark?.mark) {
          expect(mark.mark.x, 'the mark is never ahead of or behind its counter').toBeCloseTo(mark.counter.x, 3);
          expect(mark.mark.y).toBeCloseTo(mark.counter.y, 3);
          const there = (await page.evaluate((i) => window.__heraklios.unitCanvas(i), m.id))!;
          if (Math.hypot(there.x - from.x, there.y - from.y) > 12) midSlide++;
        }
        await page.waitForTimeout(20);
      }
      expect(midSlide, 'a mid-slide frame was read').toBeGreaterThan(0);
      expect(await activity(page, m.id)).toBe('done');
      expect(errors).toEqual([]);
    });
  }
});

test.describe('at Off speed', () => {
  test.use({
    storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:5232', localStorage: [{ name: 'heraklios.animationSpeed', value: 'off' }] }] },
  });

  test('the mark equals the counter right after the click (standard view)', async ({ page }) => {
    const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
    expect(await page.evaluate(() => window.__heraklios.animationSpeed())).toBe('off');
    expect(await page.evaluate(() => window.__heraklios.boardView())).toBe('standard');
    const m = await fullSpend(page);
    await clickHex(page, m.from);
    await clickHex(page, m.to);
    await waitIdle(page);
    const mark = (await page.evaluate(() => window.__heraklios.unitMarks()))[m.id]!;
    expect(mark.mark, 'the mark is drawn').not.toBeNull();
    expect(mark.mark!.x).toBeCloseTo(mark.counter.x, 3);
    expect(mark.mark!.y).toBeCloseTo(mark.counter.y, 3);
    expect(await activity(page, m.id)).toBe('done');
    expect(errors).toEqual([]);
  });
});
