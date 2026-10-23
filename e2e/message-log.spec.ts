// §49: the Board keeps every message in a scrollable log, clear of the
// bottom-left buttons. From "Combat test mode": thirty "Nothing to undo."
// entries overflow the panel (E1), the wheel over the panel scrolls it and
// leaves the map's zoom alone (E2), the scrollbar thumb drags (E3), and a
// combat report is one more entry under the earlier ones (E4).
//
// The seed only makes a failure replay the same rolls; nothing asserted
// depends on the roll.
import { expect, test, type Page } from '@playwright/test';
import { MENU_CLOSE_COMBAT, activeUnitOfType, clickButton, clickHex, key, settle, startFromMenu, state, waitIdle } from './helpers';

const NOTHING_TO_UNDO = 'Nothing to undo.';
const UNDO_CLICKS = 30;

const logEntries = (page: Page) => page.evaluate(() => window.__heraklios.logEntries());
const panel = (page: Page) => page.evaluate(() => window.__heraklios.logPanel());
const zoom = (page: Page) => page.evaluate(() => window.__heraklios.cameraZoom());

async function frames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function canvasBox(page: Page) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('No canvas on the page');
  return box;
}

async function wheelAt(page: Page, pt: { x: number; y: number }, deltaY: number): Promise<void> {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + pt.x, box.y + pt.y);
  await page.mouse.wheel(0, deltaY);
  await frames(page);
}

test('the log keeps every message, scrolls, and stays clear of the buttons (seed 1)', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_CLOSE_COMBAT, 'close-combat', 1);

  // E1: nothing to undo yet, thirty times.
  for (let i = 0; i < UNDO_CLICKS; i++) await clickButton(page, 'Undo');
  const entries = await logEntries(page);
  expect(entries[0]!.kind).toBe('heading');
  expect(entries[0]!.text).toMatch(/^Turn 1 — /);
  expect(entries.slice(1)).toEqual(Array.from({ length: UNDO_CLICKS }, () => ({ kind: 'entry', text: NOTHING_TO_UNDO })));
  const p0 = await panel(page);
  expect(p0.bottom).toBeLessThanOrEqual(750 - 232);
  const endGame = await page.evaluate(() => window.__heraklios.buttonToCanvas('End game'));
  expect(p0.bottom, 'above the End game button').toBeLessThan(endGame.y - 8);

  // E2: it overflows, so the view sits at the bottom; the wheel over the log scrolls it, not the map.
  expect(p0.total).toBeGreaterThan(p0.visible);
  expect(p0.offset).toBe(p0.total - p0.visible);
  const zoom0 = await zoom(page);
  await wheelAt(page, { x: 100, y: 300 }, -100);
  const p1 = await panel(page);
  expect(p1.offset).toBeLessThan(p0.offset);
  expect(await zoom(page)).toBe(zoom0);
  // A new entry doesn't move a view scrolled up.
  await clickButton(page, 'Undo');
  const p2 = await panel(page);
  expect(p2.total).toBe(p0.total + 1);
  expect(p2.offset).toBe(p1.offset);
  // The probe can fail: the wheel over the map does zoom it.
  await wheelAt(page, { x: 700, y: 400 }, -100);
  expect(await zoom(page)).not.toBe(zoom0);
  expect((await panel(page)).offset).toBe(p1.offset);

  // E3: dragging the thumb scrolls.
  const before = await panel(page);
  expect(before.thumb).not.toBeNull();
  const box = await canvasBox(page);
  await page.mouse.move(box.x + before.thumb!.x, box.y + before.thumb!.y);
  await page.mouse.down();
  await page.mouse.move(box.x + before.thumb!.x, box.y + before.thumb!.y - 40, { steps: 5 });
  await page.mouse.up();
  await frames(page);
  const dragged = await panel(page);
  expect(dragged.offset).toBeLessThan(before.offset);
  // And back to the bottom, where it follows again.
  await wheelAt(page, { x: 100, y: 300 }, 5000);
  const bottom = await panel(page);
  expect(bottom.offset).toBe(bottom.total - bottom.visible);

  // E4: a ranged attack adds its report under the earlier entries, with no new heading.
  const st = await state(page);
  const me = st.seatOrder[st.activePlayerIndex]!;
  const archers = await activeUnitOfType(page, 'archers');
  const step = archers.position.r < 4 ? 1 : -1;
  const target = st.units.find(
    (u) => u.owner !== me && u.position.q === archers.position.q && u.position.r === archers.position.r + 2 * step,
  );
  if (!target) throw new Error(`No enemy two hexes from the archers at ${key(archers.position)}`);
  await clickButton(page, 'End phase');
  await waitIdle(page);
  await clickHex(page, archers.position);
  await clickHex(page, target.position);
  await clickButton(page, 'Resolve attack');
  await settle(page);
  const after = await logEntries(page);
  expect(after.filter((e) => e.kind === 'heading')).toHaveLength(1);
  expect(after.slice(0, entries.length)).toEqual(entries);
  expect(after.length).toBeGreaterThan(entries.length + 1); // + the extra Undo and the report
  expect(after[after.length - 1]!.text, 'the combat report is longer than one line').toContain('\n');

  expect(errors).toEqual([]);
});
