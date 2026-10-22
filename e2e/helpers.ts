// Shared steps for the smoke scenarios (intents/32-e2e-smoke-suite). Every
// interaction is a real click on the canvas; the dev-only `window.__heraklios`
// hook (src/ui/devHook.ts) only says where to click and what the state is.
import { expect, type Page } from '@playwright/test';
import type { DevHook } from '../src/ui/devHook';
import type { GameState } from '../src/engine/state';

declare global {
  interface Window {
    __heraklios: DevHook;
  }
}

export type Hex = { q: number; r: number };

export const MENU_TEST = 'Test mode (2 players, armies ready)';
export const MENU_CLOSE_COMBAT = 'Combat test mode (units face to face, 2 hexes)';

/** Every page error and console error lands in the returned list; assert it is empty at the end. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Full Chromium (--headed) requests /favicon.ico on its own; index.html
    // declares no icon, so Vite answers 404. That is the browser, not the
    // game — every other 404 stays fatal.
    if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text());
  });
  return errors;
}

/**
 * Opens the game, seeds the dice, clicks a Menu shortcut and waits for an
 * idle Board — then checks the shortcut that actually ran (spec B5), so a
 * scenario can't pass from the wrong starting position. Returns the list
 * every page error and console error lands in; assert it is empty at the end.
 */
export async function startFromMenu(
  page: Page,
  label: string,
  scenario: 'test' | 'close-combat',
  seed: number,
): Promise<string[]> {
  const errors = collectErrors(page);
  // The scenarios match English labels, so pin the language before the page
  // loads rather than depend on the browser's locale (§35 B11).
  await page.addInitScript(() => localStorage.setItem('heraklios.language', 'en'));
  await page.goto('/');
  await page.waitForFunction((l) => window.__heraklios?.buttonCount(l) === 1, label);
  await page.evaluate((n) => window.__heraklios.seed(n), seed);
  await clickButton(page, label);
  await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  await waitIdle(page);
  expect(await page.evaluate(() => window.__heraklios.testScenario()), 'started from the intended test mode').toBe(scenario);
  return errors;
}

/** Waits until nothing is pending on the board. `idle()` throws if BoardScene lost a field it reads — that fails the test. */
export async function waitIdle(page: Page, timeout = 10_000): Promise<void> {
  try {
    await page.waitForFunction(() => window.__heraklios.idle(), undefined, { timeout });
  } catch (e) {
    const busy = await page.evaluate(() => window.__heraklios.busy()).catch(() => ['(hook unreachable)']);
    throw new Error(`Board never went idle; still busy with: ${busy.join(', ')}. ${(e as Error).message}`);
  }
}

/**
 * Waits for the board to go idle, answering any prompt the last action
 * raised the way a player would: the first highlighted hex for a retreat or
 * push choice, "Don't advance" for an advance offer. Whatever the dice did,
 * the scenario continues from a settled board.
 */
export async function settle(page: Page, timeout = 10_000, maxPrompts = 10): Promise<void> {
  const deadline = Date.now() + timeout;
  let answered = 0;
  while (Date.now() < deadline && answered <= maxPrompts) {
    const now = await page.evaluate(() => ({
      idle: window.__heraklios.idle(),
      hexes: window.__heraklios.pendingHexes(),
      decline: window.__heraklios.buttonCount("Don't advance") === 1,
    }));
    if (now.idle) return;
    if (now.hexes.length) {
      await clickHex(page, now.hexes[0]!);
      answered++;
    } else if (now.decline) {
      await clickButton(page, "Don't advance");
      answered++;
    } else {
      await page.waitForTimeout(50); // a tween or an async step still running
    }
  }
  await waitIdle(page, 1); // fails with the busy reasons
}

export async function state(page: Page): Promise<GameState> {
  return (await page.evaluate(() => window.__heraklios.state())) as GameState;
}

export async function unit(page: Page, id: string) {
  const u = (await state(page)).units.find((x) => x.id === id);
  if (!u) throw new Error(`No unit ${id}`);
  return u;
}

/** The unit of `typeId` the active player owns. */
export async function activeUnitOfType(page: Page, typeId: string) {
  const st = await state(page);
  const pid = st.seatOrder[st.activePlayerIndex];
  const u = st.units.find((x) => x.owner === pid && x.typeId === typeId && !x.destroyed);
  if (!u) throw new Error(`Active player has no ${typeId}`);
  return u;
}

export async function reachable(page: Page, unitId: string): Promise<string[]> {
  return page.evaluate((id) => window.__heraklios.reachable(id), unitId);
}

export const key = (h: Hex) => `${h.q},${h.r}`;

async function frames(page: Page): Promise<void> {
  // The camera's transform updates on render; let two frames pass.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function clickCanvas(page: Page, pt: { x: number; y: number }): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('No canvas on the page');
  await page.mouse.click(box.x + pt.x, box.y + pt.y);
}

export async function clickButton(page: Page, label: string, index?: number): Promise<void> {
  const pt = await page.evaluate(([l, i]) => window.__heraklios.buttonToCanvas(l as string, i as number | undefined), [label, index] as const);
  await clickCanvas(page, pt);
}

/**
 * Waits until the Save/Load panel has its slot list from the save API: until
 * then its buttons are off (the rows say "Loading..."), and a disabled button
 * is not a click target. `manage` mode only (it has Save buttons).
 */
export async function waitSavePanelLoaded(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__heraklios.buttonCount('Save') === 6);
}

/** The index of the panel's Load button on the same row as a Save button at `savePoint`. */
export async function loadOnSameRowAs(page: Page, savePoint: { x: number; y: number }): Promise<number> {
  const n = await page.evaluate(() => window.__heraklios.buttonCount('Load'));
  for (let i = 0; i < n; i++) {
    const p = await page.evaluate((j) => window.__heraklios.buttonToCanvas('Load', j), i);
    if (Math.abs(p.y - savePoint.y) < 1) return i;
  }
  throw new Error('No Load button on the saved row');
}

/** Centres the camera on `hex`, then clicks it. */
export async function clickHex(page: Page, hex: Hex): Promise<void> {
  const pt = await hexPoint(page, hex);
  await clickCanvas(page, pt);
}

async function hexPoint(page: Page, hex: Hex): Promise<{ x: number; y: number }> {
  await page.evaluate((h) => window.__heraklios.centerOn(h), hex);
  await frames(page);
  const pt = await page.evaluate((h) => window.__heraklios.hexToCanvas(h), hex);
  expect(pt, `hex ${key(hex)} on screen`).not.toBeNull();
  return pt!;
}

/** A 24×24 screenshot around a hex's centre (§30's small-region check). */
export async function hexShot(page: Page, hex: Hex): Promise<Buffer> {
  const pt = await hexPoint(page, hex);
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('No canvas on the page');
  return page.screenshot({ clip: { x: box.x + pt.x - 12, y: box.y + pt.y - 12, width: 24, height: 24 } });
}
