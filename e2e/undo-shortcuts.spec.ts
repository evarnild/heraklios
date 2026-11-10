// §62: one Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y press runs one undo or redo, even
// when the whole shortcut (Control down, Z down, Z up, Control up) lands in one
// frame. Phaser re-walks its key queue after each event and re-emits the queued
// events' handlers; the guard keys on the event object so a re-emit is skipped.
//
// The burst is dispatched in ONE page.evaluate, i.e. one task, so the events
// share a frame as they do on a slow one. Phaser reads `keyCode`, which a
// synthetic KeyboardEvent leaves 0, so it is defined on each event.
import { expect, test, type Page } from '@playwright/test';
import {
  MENU_CLOSE_COMBAT,
  activeUnitOfType,
  clickButton,
  clickHex,
  collectErrors,
  key,
  startFromMenu,
  state,
  waitIdle,
} from './helpers';

type Chord = { shift?: boolean; ctrl?: boolean; letter: 'Z' | 'Y' };

/** Delivers a whole shortcut in one task. */
async function burst(page: Page, chord: Chord): Promise<void> {
  await page.evaluate(({ shift, ctrl, letter }) => {
    const send = (type: string, k: string, code: number, mods: Record<string, boolean>) => {
      const e = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true, ...mods });
      Object.defineProperty(e, 'keyCode', { value: code });
      window.dispatchEvent(e);
    };
    const mods = { ctrlKey: !!ctrl, shiftKey: !!shift };
    const code = letter === 'Z' ? 90 : 89;
    if (ctrl) send('keydown', 'Control', 17, { ctrlKey: true });
    if (shift) send('keydown', 'Shift', 16, { ctrlKey: !!ctrl, shiftKey: true });
    send('keydown', letter, code, mods);
    send('keyup', letter, code, mods);
    if (shift) send('keyup', 'Shift', 16, { ctrlKey: !!ctrl });
    if (ctrl) send('keyup', 'Control', 17, {});
  }, chord);
  // Let Phaser process the frame.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const texts = async (page: Page) =>
  (await page.evaluate(() => window.__heraklios.logEntries())).map((e) => e.text).filter((t) => t !== 'Autosaved.');
const count = async (page: Page, prefix: string) => (await texts(page)).filter((t) => t.startsWith(prefix)).length;

test('one undo or redo shortcut on the Board undoes or redoes one step (seed 1)', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_CLOSE_COMBAT, 'close-combat', 1);
  await clickButton(page, 'End phase');
  await waitIdle(page);
  const st = await state(page);
  const me = st.seatOrder[st.activePlayerIndex]!;
  const archers = await activeUnitOfType(page, 'archers');
  const step = archers.position.r < 4 ? 1 : -1;
  const target = st.units.find(
    (u) => u.owner !== me && u.position.q === archers.position.q && u.position.r === archers.position.r + 2 * step,
  );
  if (!target) throw new Error(`No enemy two hexes from the archers at ${key(archers.position)}`);
  await clickHex(page, archers.position); // history entry 1: select
  await clickHex(page, target.position); // history entry 2: target

  // A bare Z is not a shortcut.
  const before = await texts(page);
  await burst(page, { letter: 'Z' });
  expect(await texts(page), 'a bare Z changes nothing').toEqual(before);

  await burst(page, { ctrl: true, letter: 'Z' });
  expect(await count(page, 'Undone:'), 'one Ctrl+Z, one undo').toBe(1);

  await burst(page, { ctrl: true, shift: true, letter: 'Z' });
  expect(await count(page, 'Redone:'), 'one Ctrl+Shift+Z, one redo').toBe(1);

  await burst(page, { ctrl: true, letter: 'Z' });
  expect(await count(page, 'Undone:')).toBe(2);
  await burst(page, { ctrl: true, letter: 'Y' });
  expect(await count(page, 'Redone:'), 'one Ctrl+Y, one redo').toBe(2);
  expect(await count(page, 'Nothing to')).toBe(0);
  expect(errors).toEqual([]);
});

test('one undo or redo shortcut in Placement undoes or redoes one placement (seed 1)', async ({ page }) => {
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

  const placed = async () => (await state(page)).units.length;
  const place = async () => {
    const n = await placed();
    const { legalHexes } = await page.evaluate(() => window.__heraklios.placement());
    const taken = new Set((await state(page)).units.map((u) => key(u.position)));
    await clickHex(page, legalHexes.find((h) => !taken.has(key(h)))!);
    await page.waitForFunction((k) => (window.__heraklios.state() as { units: unknown[] }).units.length === k + 1, n);
  };
  const base = await placed();
  await place();
  await place();
  expect(await placed()).toBe(base + 2);

  await burst(page, { letter: 'Z' });
  expect(await placed(), 'a bare Z changes nothing').toBe(base + 2);
  await burst(page, { ctrl: true, letter: 'Z' });
  expect(await placed(), 'one Ctrl+Z takes back one unit').toBe(base + 1);
  await burst(page, { ctrl: true, shift: true, letter: 'Z' });
  expect(await placed(), 'one Ctrl+Shift+Z puts one back').toBe(base + 2);
  await burst(page, { ctrl: true, letter: 'Z' });
  expect(await placed()).toBe(base + 1);
  await burst(page, { ctrl: true, letter: 'Y' });
  expect(await placed(), 'one Ctrl+Y puts one back').toBe(base + 2);
  expect(errors).toEqual([]);
});
