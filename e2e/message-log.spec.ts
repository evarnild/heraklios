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

const UNDO = '↶ Undo';
const NOTHING_TO_UNDO = 'Nothing to undo.';
const UNDO_CLICKS = 30;

// The async "Autosaved." line (§53) lands at an unpredictable point among the
// entries this scenario counts, so it is left out of what it reads.
const logEntries = async (page: Page) =>
  (await page.evaluate(() => window.__heraklios.logEntries())).filter((e) => e.text !== 'Autosaved.');
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
  for (let i = 0; i < UNDO_CLICKS; i++) await clickButton(page, UNDO);
  const entries = await logEntries(page);
  expect(entries[0]!.kind).toBe('heading');
  expect(entries[0]!.text).toMatch(/^Turn 1 — /);
  expect(entries.slice(1)).toEqual(Array.from({ length: UNDO_CLICKS }, () => ({ kind: 'entry', text: NOTHING_TO_UNDO })));
  const p0 = await panel(page);
  expect(p0.bottom).toBeLessThanOrEqual(750 - 232);
  const endGame = await page.evaluate(() => window.__heraklios.buttonToCanvas('⚑ End game'));
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
  await clickButton(page, UNDO);
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
  const archersHex = (await activeUnitOfType(page, 'archers')).position;
  const archersAt = () => page.evaluate((h) => window.__heraklios.hexToCanvas(h), archersHex);
  const archersBefore = await archersAt();
  const box = await canvasBox(page);
  await page.mouse.move(box.x + before.thumb!.x, box.y + before.thumb!.y);
  await page.mouse.down();
  await page.mouse.move(box.x + before.thumb!.x, box.y + before.thumb!.y - 40, { steps: 5 });
  await page.mouse.up();
  await frames(page);
  const dragged = await panel(page);
  expect(dragged.offset).toBeLessThan(before.offset);
  // The drag scrolls the log only: the map must not pan with it.
  expect(await archersAt(), 'the map did not pan').toEqual(archersBefore);
  // And back to the bottom, where it follows again.
  for (let i = 0; i < 10; i++) await wheelAt(page, { x: 100, y: 300 }, 100);
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
  // The report is one entry of several lines; a later message (a retreat) may follow it.
  expect(after.slice(entries.length).some((e) => e.text.includes('\n')), 'the combat report is longer than one line').toBe(true);

  expect(errors).toEqual([]);
});

// B2: a heading when the active player changes within a turn, and again when the turn changes.
test('a new heading starts the next player and the next turn (seed 1)', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_CLOSE_COMBAT, 'close-combat', 1);
  const headings = async () => (await logEntries(page)).filter((e) => e.kind === 'heading').map((e) => e.text);
  const active = async () => {
    const st = await state(page);
    return { player: st.seatOrder[st.activePlayerIndex], turn: st.turnNumber };
  };
  const first = await active();
  await clickButton(page, UNDO);
  expect(await headings()).toHaveLength(1);

  // End phases until the other player is up, then log something for them.
  while ((await active()).player === first.player) {
    await clickButton(page, 'End phase');
    await settle(page);
  }
  expect((await active()).turn, 'same turn, other player').toBe(first.turn);
  await clickButton(page, UNDO);
  const second = await headings();
  expect(second).toHaveLength(2);
  expect(second[1]).toMatch(new RegExp(`^Turn ${first.turn} — `));
  expect(second[1]).not.toBe(second[0]);

  // And on to the next turn.
  while ((await active()).turn === first.turn) {
    await clickButton(page, 'End phase');
    await settle(page);
  }
  await clickButton(page, UNDO);
  const third = await headings();
  expect(third).toHaveLength(3);
  expect(third[2]).toMatch(new RegExp(`^Turn ${first.turn + 1} — `));
  expect(errors).toEqual([]);
});
