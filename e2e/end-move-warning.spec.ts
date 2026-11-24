// §83: End phase in a human seat's movement phase, with units that have not
// moved and could, opens a warning: the camera frames them, each gets a mark,
// and a prompt in the side panel offers "End phase anyway" or "Cancel".
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { unmovedUnits } from '../src/engine/unmoved';
import { en } from '../src/ui/i18n/en';
import {
  MENU_TEST,
  activeUnitOfType,
  chord,
  clickButton,
  clickHex,
  frames,
  key,
  reachable,
  startFromMenu,
  state,
  unit,
  waitIdle,
  waitLoadOnRowOf,
  waitSavePanelLoaded,
  loadOnSameRowAs,
  endPhase,
} from './helpers';
import { SAVES_DIR, acquireSaveLock, withSaveLockHeld } from './savesDir';

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]] as const;
const WARN_OFF_OFF = "☐ Don't warn me again this game";
const SLOT_1_FILE = join(SAVES_DIR, 'slot-1.json');

async function moveOneHex(page: Page, typeId: string) {
  const mover = await activeUnitOfType(page, typeId);
  const reach = await reachable(page, mover.id);
  const to = DIRS.map(([dq, dr]) => ({ q: mover.position.q + dq, r: mover.position.r + dr })).find((h) =>
    reach.includes(key(h)),
  );
  if (!to) throw new Error(`${typeId} has no adjacent reachable hex`);
  await clickHex(page, mover.position);
  await clickHex(page, to);
  await waitIdle(page);
  expect((await unit(page, mover.id)).position).toEqual(to);
  return { id: mover.id, from: mover.position };
}

const warning = (page: Page) => page.evaluate(() => window.__heraklios.endMoveWarning());
const camera = async (page: Page) => ({
  zoom: await page.evaluate(() => window.__heraklios.cameraZoom()),
  scroll: await page.evaluate(() => window.__heraklios.cameraScroll()),
});
const logTexts = async (page: Page) => (await page.evaluate(() => window.__heraklios.logEntries())).map((e) => e.text);

/** Clicks End phase and waits for the warning (two frames: the Tables panel hides in `update`). */
async function openWarning(page: Page): Promise<void> {
  await clickButton(page, 'End phase');
  await frames(page);
  await frames(page);
  expect((await warning(page)).open).toBe(true);
}

async function tickAndConfirm(page: Page): Promise<void> {
  await clickButton(page, WARN_OFF_OFF);
  await clickButton(page, 'End phase anyway');
  await waitIdle(page);
}

test('the warning frames, marks and holds every control; Cancel and the keys answer it (seed 1)', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const moved = await moveOneHex(page, 'fantassins');
  const before = await camera(page);

  await openWarning(page);
  const st = await state(page);
  expect(st.phase).toBe('movement');

  // AC5: the flagged ids are the engine's, computed here on the state copy.
  const w = await warning(page);
  const oracle = unmovedUnits(st, {}).map((u) => u.id);
  expect(oracle.length).toBeGreaterThan(0);
  expect(oracle).not.toContain(moved.id);
  expect(w.flagged).toEqual(oracle);
  expect(w.marked).toEqual(w.flagged);
  for (const id of w.flagged) {
    const u = st.units.find((x) => x.id === id)!;
    expect(await page.evaluate((h) => window.__heraklios.hexToCanvas(h), u.position), id).not.toBeNull();
  }
  const framed = await camera(page);
  expect(framed.zoom).toBeGreaterThanOrEqual(0.4);
  expect(framed.zoom).toBeLessThanOrEqual(before.zoom);
  expect((await page.evaluate(() => window.__heraklios.hudStrays())).strays).toEqual([]);

  // AC12: undo is refused, and a board click selects nothing.
  await chord(page, ['Control'], 'z');
  expect((await logTexts(page)).at(-1)).toBe('Resolve the pending choice before undoing.');
  expect(await state(page)).toEqual(st);
  const own = st.units.find((u) => u.id === w.flagged[0]!)!;
  await clickHex(page, own.position);
  expect(await page.evaluate(() => window.__heraklios.selectedUnitId())).toBeNull();

  // AC6: Cancel leaves everything as it was.
  await clickButton(page, en.common.cancel);
  await frames(page);
  expect(await warning(page)).toMatchObject({ open: false, marked: [] });
  expect(await camera(page)).toEqual(before);
  expect((await state(page)).phase).toBe('movement');

  // AC7: Escape is Cancel, Enter is End phase anyway.
  await openWarning(page);
  await page.keyboard.press('Escape');
  await frames(page);
  expect(await warning(page)).toMatchObject({ open: false });
  expect((await state(page)).phase).toBe('movement');
  await openWarning(page);
  await page.keyboard.press('Enter');
  await waitIdle(page);
  expect((await state(page)).phase).toBe('combat');

  expect(errors).toEqual([]);
});

test('Cancel keeps the history: Ctrl+Z puts the moved unit back (seed 1)', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const moved = await moveOneHex(page, 'fantassins');
  await openWarning(page);
  await clickButton(page, en.common.cancel);
  await frames(page);
  await chord(page, ['Control'], 'z');
  await waitIdle(page);
  expect((await unit(page, moved.id)).position).toEqual(moved.from);
  expect(errors).toEqual([]);
});

test('End phase anyway ends the phase and clears the undo history (seed 1)', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  await moveOneHex(page, 'fantassins');
  const before = await camera(page);
  await openWarning(page);
  await clickButton(page, 'End phase anyway');
  await waitIdle(page);

  expect((await state(page)).phase).toBe('combat');
  expect(await warning(page)).toMatchObject({ open: false, marked: [] });
  expect(await camera(page)).toEqual(before);
  await chord(page, ['Control'], 'z');
  expect((await logTexts(page)).at(-1)).toBe('Nothing to undo.');

  // AC13: the combat phase ends with no warning.
  await clickButton(page, 'End phase');
  await frames(page);
  expect(await warning(page)).toMatchObject({ open: false });
  expect((await state(page)).phase).toBe('movement');
  expect(errors).toEqual([]);
});

test('"Don\'t warn me again" switches the warning off for that seat only (seed 1)', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const first = (await state(page)).activePlayerIndex;
  await openWarning(page);
  await tickAndConfirm(page);
  expect((await logTexts(page)).some((t) => t.startsWith('End-phase warning off for'))).toBe(true);
  expect((await warning(page)).switchedOff.length).toBe(1);

  await endPhase(page); // combat -> player 2's movement
  await waitIdle(page);
  expect((await state(page)).activePlayerIndex).not.toBe(first);
  await openWarning(page); // player 2 is still warned
  await clickButton(page, 'End phase anyway');
  await waitIdle(page);
  await endPhase(page); // combat -> player 1's movement
  await waitIdle(page);

  const back = await state(page);
  expect(back.activePlayerIndex).toBe(first);
  expect(back.phase).toBe('movement');
  await clickButton(page, 'End phase'); // no warning for the switched-off seat
  await frames(page);
  expect(await warning(page)).toMatchObject({ open: false });
  expect((await state(page)).phase).toBe('combat');
  expect(errors).toEqual([]);
});

test('the switch-off is forgotten when a game is loaded (seed 1)', async ({ page }) => {
  await acquireSaveLock();
  try {
    rmSync(SLOT_1_FILE, { force: true });
    const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
    await clickButton(page, '💾 Save / Load');
    await waitSavePanelLoaded(page);
    const savePoint = await page.evaluate(() => window.__heraklios.buttonToCanvas('Save', 0));
    await clickButton(page, 'Save', 0);
    await waitLoadOnRowOf(page, savePoint);
    await clickButton(page, 'Close');
    await waitIdle(page);
    expect(JSON.parse(readFileSync(SLOT_1_FILE, 'utf8'))).toBeTruthy();

    await openWarning(page);
    await tickAndConfirm(page);
    expect((await warning(page)).switchedOff.length).toBe(1);

    await clickButton(page, '💾 Save / Load');
    await waitSavePanelLoaded(page);
    await clickButton(page, 'Load', await loadOnSameRowAs(page, savePoint));
    await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
    await waitIdle(page);
    expect((await warning(page)).switchedOff).toEqual([]);
    await openWarning(page);
    expect(errors).toEqual([]);
  } finally {
    await withSaveLockHeld(() => {});
  }
});

test('the Tables panel hides while the warning is open and returns as it was (seed 1)', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  await clickButton(page, en.board.tables);
  const panel = () => page.evaluate(() => window.__heraklios.rulesPanel());
  const opened = await panel();
  expect(opened.open).toBe(true);
  await openWarning(page);
  expect((await panel()).open).toBe(false);
  await clickButton(page, en.common.cancel);
  await frames(page);
  expect(await panel()).toMatchObject({ open: true, tab: opened.tab });
  expect(errors).toEqual([]);
});
