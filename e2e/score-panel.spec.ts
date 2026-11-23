// §81: the always-on score panel at the bottom right of the Board. Every
// figure is compared with the engine's `playerScores` applied to `state()`,
// never with constants, so the panel and the engine cannot drift apart. The
// bonus case crafts a save (one fleet destroyed) because sinking a fleet by
// dice is not reliable in a smoke test. Uses save slot 3, under the save lock.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { currentPlayer } from '../src/engine/state';
import { playerScores } from '../src/engine/score';
import { fr } from '../src/ui/i18n/fr';
import {
  MENU_CLOSE_COMBAT,
  MENU_TEST,
  activeUnitOfType,
  clickButton,
  clickHex,
  collectErrors,
  loadOnSameRowAs,
  settle,
  startFromMenu,
  state,
  waitIdle,
  waitLoadOnRowOf,
  waitSavePanelLoaded,
} from './helpers';
import { SAVES_DIR, acquireSaveLock, withSaveLockHeld } from './savesDir';

const DRAWN = '🗺 Drawn view';
const SAVE_LOAD = '💾 Save / Load';
const SLOT_3_FILE = join(SAVES_DIR, 'slot-3.json');

const panel = (page: Page) => page.evaluate(() => window.__heraklios.scorePanel());
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** What the panel should show for the page's current state, from the engine. */
async function expected(page: Page) {
  const st = await state(page);
  const active = currentPlayer(st).id;
  return playerScores(st).map((s) => ({
    playerId: s.playerId,
    score: s.score,
    atSea: s.navalBonus > 0,
    unitsLeft: s.unitsLeft,
    active: s.playerId === active,
    marker: s.playerId === active, // the marker follows the highlight
  }));
}

async function expectRowsMatchEngine(page: Page, label: string) {
  await frames(page);
  expect((await panel(page)).rows, label).toEqual(await expected(page));
}

function expectInBottomRight(rect: { left: number; top: number; width: number; height: number }) {
  expect(rect.left).toBeGreaterThanOrEqual(788);
  expect(rect.left + rect.width).toBeLessThanOrEqual(1088);
  expect(rect.top + rect.height).toBeLessThanOrEqual(742);
}

/** The load is async (an HTTP read): wait for the message the Board logs once it has applied. */
async function waitLoaded(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__heraklios.logEntries().some((e) => e.text === 'Game loaded.'));
  await waitIdle(page);
  await frames(page);
}

async function endTurn(page: Page): Promise<void> {
  await clickButton(page, 'End phase'); // movement -> combat
  await waitIdle(page);
  await clickButton(page, 'End phase'); // combat -> the next player
  await waitIdle(page);
}

async function burst(page: Page, chord: { shift?: boolean; ctrl?: boolean; letter: 'Z' | 'Y' }): Promise<void> {
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
}

test('the panel shows the engine figures, follows the turn and survives the view switch', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const first = await panel(page);
  expect(first.rows).toHaveLength(2);
  expect(first.fits).toBe(true);
  expectInBottomRight(first.rect);
  await expectRowsMatchEngine(page, 'at the start');
  expect(first.rows.filter((r) => r.active)).toHaveLength(1);
  const firstActive = first.rows.find((r) => r.active)!.playerId;

  await endTurn(page);
  await expectRowsMatchEngine(page, 'after one turn');
  const second = (await panel(page)).rows.find((r) => r.active)!.playerId;
  expect(second, 'the other player is active').not.toBe(firstActive);

  await endTurn(page);
  await expectRowsMatchEngine(page, 'after two turns');
  expect((await panel(page)).rows.find((r) => r.active)!.playerId).toBe(firstActive);

  const standard = await panel(page);
  await clickButton(page, DRAWN);
  await page.waitForFunction(() => window.__heraklios.boardView() === 'drawn');
  await frames(page);
  const drawn = await panel(page);
  expect(drawn.rect).toEqual(standard.rect);
  expect(drawn.rows).toEqual(standard.rows);
  expect(drawn.fits).toBe(true);
  expect(errors).toEqual([]);
});

test('a wheel over the panel does not zoom the map', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const { rect } = await panel(page);
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom = await page.evaluate(() => window.__heraklios.cameraZoom());
  await page.mouse.move(box.x + rect.left + rect.width / 2, box.y + rect.top + rect.height / 2);
  await page.mouse.wheel(0, -300);
  await frames(page);
  expect(await page.evaluate(() => window.__heraklios.cameraZoom())).toBe(zoom);
  expect(errors).toEqual([]);
});

test('the rows follow combat, undo and redo (seed 1)', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_CLOSE_COMBAT, 'close-combat', 1);
  const st = await state(page);
  const me = st.seatOrder[st.activePlayerIndex];
  const archers = await activeUnitOfType(page, 'archers');
  const step = archers.position.r < 4 ? 1 : -1;
  const target = st.units.find(
    (u) => u.owner !== me && u.position.q === archers.position.q && u.position.r === archers.position.r + 2 * step,
  )!;
  await clickButton(page, 'End phase');
  await waitIdle(page);
  await clickHex(page, archers.position);
  await clickHex(page, target.position);
  await clickButton(page, 'Resolve attack');
  await settle(page);
  await expectRowsMatchEngine(page, 'after the attack');
  await burst(page, { ctrl: true, letter: 'Z' });
  await settle(page);
  await expectRowsMatchEngine(page, 'after undo');
  await burst(page, { ctrl: true, shift: true, letter: 'Z' });
  await settle(page);
  await expectRowsMatchEngine(page, 'after redo');
  expect(errors).toEqual([]);
});

async function growScenario(page: Page, context: BrowserContext): Promise<void> {
  // A 4-player Board (the dev figure gallery) saves into slot 3 ...
  const gallery = await context.newPage();
  const galleryErrors = collectErrors(gallery);
  await gallery.addInitScript(() => localStorage.setItem('heraklios.language', 'en'));
  await gallery.goto('/');
  await gallery.waitForFunction(() => window.__heraklios?.buttonCount('Figure gallery (dev)') === 1);
  await clickButton(gallery, 'Figure gallery (dev)');
  await gallery.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  await waitIdle(gallery);
  expect((await panel(gallery)).rows).toHaveLength(4);
  await clickButton(gallery, SAVE_LOAD);
  await waitSavePanelLoaded(gallery);
  const slot3 = await gallery.evaluate(() => window.__heraklios.buttonToCanvas('Save', 2));
  await clickButton(gallery, 'Save', 2);
  await waitLoadOnRowOf(gallery, slot3);
  await gallery.close();

  // ... and loads into a running 2-player Board without a restart.
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  expect((await panel(page)).rows).toHaveLength(2);
  await clickButton(page, SAVE_LOAD);
  await waitSavePanelLoaded(page);
  const point = await page.evaluate(() => window.__heraklios.buttonToCanvas('Save', 2));
  await clickButton(page, 'Load', await loadOnSameRowAs(page, point));
  await waitLoaded(page);

  const after = await panel(page);
  expect(after.rows.map((r) => r.playerId)).toEqual([0, 1, 2, 3]);
  expect(after.fits).toBe(true);
  expectInBottomRight(after.rect);
  await expectRowsMatchEngine(page, 'after the 4-player load');
  expect(galleryErrors).toEqual([]);
  expect(errors).toEqual([]);
}

async function shrinkScenario(page: Page, context: BrowserContext): Promise<void> {
  // A 2-player Test mode Board saves into slot 3 ...
  const two = await context.newPage();
  const twoErrors = await startFromMenu(two, MENU_TEST, 'test', 1);
  await clickButton(two, SAVE_LOAD);
  await waitSavePanelLoaded(two);
  const slot3 = await two.evaluate(() => window.__heraklios.buttonToCanvas('Save', 2));
  await clickButton(two, 'Save', 2);
  await waitLoadOnRowOf(two, slot3);
  await two.close();

  // ... and loads in place into the 4-player gallery Board.
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('heraklios.language', 'en'));
  await page.goto('/');
  await page.waitForFunction(() => window.__heraklios?.buttonCount('Figure gallery (dev)') === 1);
  await clickButton(page, 'Figure gallery (dev)');
  await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  await waitIdle(page);
  const before = await panel(page);
  expect(before.rows).toHaveLength(4);
  await clickButton(page, SAVE_LOAD);
  await waitSavePanelLoaded(page);
  const point = await page.evaluate(() => window.__heraklios.buttonToCanvas('Save', 2));
  await clickButton(page, 'Load', await loadOnSameRowAs(page, point));
  await waitLoaded(page);

  const after = await panel(page);
  expect(after.rows.map((r) => r.playerId)).toEqual([0, 1]);
  expect(after.fits).toBe(true);
  expect(after.rect.height).toBeLessThan(before.rect.height);
  expectInBottomRight(after.rect);
  await expectRowsMatchEngine(page, 'after the 2-player load');

  // The old, taller panel's top strip is the board again: a hover there reaches a hex
  // (a leftover interactive background would swallow it).
  const stripBottom = Math.floor(after.rect.top - 2); // inside the old, taller panel
  expect(stripBottom).toBeGreaterThanOrEqual(before.rect.top);
  const box = (await page.locator('canvas').boundingBox())!;
  let reached = 0;
  for (let x = after.rect.left + 10; x < after.rect.left + after.rect.width; x += 30) {
    await page.mouse.move(box.x + x, box.y + stripBottom);
    await frames(page);
    if ((await page.evaluate(() => window.__heraklios.tooltipText())) !== null) reached++;
  }
  expect(reached, 'a hover above the shrunk panel reaches the board').toBeGreaterThan(0);
  expect(twoErrors).toEqual([]);
  expect(errors).toEqual([]);
}

test.describe('the bonus after a load', () => {
  test.beforeEach(async () => {
    await acquireSaveLock();
    rmSync(SLOT_3_FILE, { force: true });
  });
  test.afterEach(() => withSaveLockHeld(() => rmSync(SLOT_3_FILE, { force: true })));

  test('a save with one fleet destroyed loads with the bonus on the other player', async ({ page }) => {
    const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
    expect((await panel(page)).rows.every((r) => !r.atSea), 'no bonus at the start').toBe(true);

    await clickButton(page, SAVE_LOAD);
    await waitSavePanelLoaded(page);
    const slot3 = await page.evaluate(() => window.__heraklios.buttonToCanvas('Save', 2));
    await clickButton(page, 'Save', 2);
    await waitLoadOnRowOf(page, slot3);
    expect(existsSync(SLOT_3_FILE)).toBe(true);
    const saved = JSON.parse(readFileSync(SLOT_3_FILE, 'utf8'));
    let sunk = 0;
    for (const u of saved.gameState.units) {
      if (u.owner === 1 && (u.typeId === 'galeres' || u.typeId === 'biremes')) {
        u.destroyed = true;
        sunk++;
      }
    }
    expect(sunk, "both of player 1's ships are sunk in the file").toBe(2);
    writeFileSync(SLOT_3_FILE, JSON.stringify(saved));

    await clickButton(page, 'Load', await loadOnSameRowAs(page, slot3));
    await waitLoaded(page);

    const rows = (await panel(page)).rows;
    const army0 = playerScores(await state(page))[0]!.armyValue;
    expect(rows[0]).toMatchObject({ playerId: 0, atSea: true, score: army0 + 30 });
    expect(rows[1]).toMatchObject({ playerId: 1, atSea: false });
    await expectRowsMatchEngine(page, 'after the load');
    expect(errors).toEqual([]);
  });
  test('an in-place load of a save with another player count shows one row per player', async ({ page, context }) => {
    await growScenario(page, context);
  });
  test('an in-place load of a save with fewer players shrinks the panel and frees the old area', async ({ page, context }) => {
    await shrinkScenario(page, context);
  });
});

test('in French every row fits the panel', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('heraklios.language', 'fr'));
  await page.goto('/');
  await page.waitForFunction((l) => window.__heraklios?.buttonCount(l) === 1, fr.menu.testMode);
  await clickButton(page, fr.menu.testMode);
  await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  await waitIdle(page);
  await frames(page);
  const p = await panel(page);
  expect(p.rows).toHaveLength(2);
  expect(p.fits).toBe(true);
  await expectRowsMatchEngine(page, 'French');
  expect(errors).toEqual([]);
});
