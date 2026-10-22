// Spec B8/B10 (intents/45-save-api): a save an older build left in the
// browser (`localStorage`) is offered for copying into the file slot of the
// same number, the copy reads the browser and never changes it, and the copy
// loads back from the file slot. Uses slot 5, which no other scenario
// touches, because the workers share one server and one saves folder.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  MENU_TEST,
  clickButton,
  loadOnSameRowAs,
  startFromMenu,
  state,
  waitIdle,
  waitLoadOnRowOf,
  waitSavePanelLoaded,
} from './helpers';
import { SAVES_DIR, acquireSaveLock, withSaveLockHeld } from './savesDir';

const SAVE_LOAD = '💾 Save / Load';
const COPY = 'Copy browser saves to files';
const BROWSER_KEY = 'heraklios.save.slot5';
const SLOT_5_FILE = join(SAVES_DIR, 'slot-5.json');
const SLOT_6_FILE = join(SAVES_DIR, 'slot-6.json');

const withoutClock = ({ elapsedMs: _clock, ...rest }: Awaited<ReturnType<typeof state>>) => rest;

// One save scenario at a time across the workers (see acquireSaveLock).
test.beforeEach(async () => {
  await acquireSaveLock();
  rmSync(SLOT_5_FILE, { force: true });
  rmSync(SLOT_6_FILE, { force: true });
});
// Only a worker that holds the lock cleans up, and it always releases; the
// files are gone before the next scenario starts (withSaveLockHeld).
test.afterEach(() =>
  withSaveLockHeld(() => {
    rmSync(SLOT_5_FILE, { force: true });
    rmSync(SLOT_6_FILE, { force: true });
  }),
);

test('a browser save is copied into its empty file slot and loads from there', async ({ page, context }) => {
  // 1. Produce a real save: play to the board, save into slot 6, keep its text, empty the slot again.
  await startFromMenu(page, MENU_TEST, 'test', 1);
  const saved = await state(page);
  await clickButton(page, SAVE_LOAD);
  await waitSavePanelLoaded(page);
  const slot6 = await page.evaluate(() => window.__heraklios.buttonToCanvas('Save', 5));
  await clickButton(page, 'Save', 5);
  await waitLoadOnRowOf(page, slot6);
  await clickButton(page, 'Close');
  const text = readFileSync(SLOT_6_FILE, 'utf8');
  rmSync(SLOT_6_FILE);

  // 2. A fresh page whose browser holds that save in slot 5, before the game loads.
  const fresh = await context.newPage();
  await fresh.addInitScript(([k, v]) => localStorage.setItem(k!, v!), [BROWSER_KEY, text]);
  const errors = await startFromMenu(fresh, MENU_TEST, 'test', 1);

  await clickButton(fresh, SAVE_LOAD);
  await waitSavePanelLoaded(fresh);
  expect(await fresh.evaluate((l) => window.__heraklios.buttonCount(l), COPY), 'the copy is offered').toBe(1);
  expect(existsSync(SLOT_5_FILE), 'no file yet').toBe(false);

  await clickButton(fresh, COPY);
  await fresh.waitForFunction((l) => window.__heraklios.buttonCount(l) === 0, COPY);
  expect(existsSync(SLOT_5_FILE), 'the file slot now holds the save').toBe(true);
  expect(JSON.parse(readFileSync(SLOT_5_FILE, 'utf8')).savedAt).toBe(JSON.parse(text).savedAt);
  expect(await fresh.evaluate((k) => localStorage.getItem(k), BROWSER_KEY), 'the browser copy is left alone').toBe(text);

  // 3. Load it back from the file slot (slot 5 = the fifth Save button's row).
  const savePoint = await fresh.evaluate(() => window.__heraklios.buttonToCanvas('Save', 4));
  await clickButton(fresh, 'Load', await loadOnSameRowAs(fresh, savePoint));
  await fresh.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  await waitIdle(fresh);
  expect(withoutClock(await state(fresh))).toEqual(withoutClock(saved));
  expect(errors).toEqual([]);
});
