// §64: the Board's view toggle. Switching between the Standard and the Drawn
// view changes only the look: the game state, the camera and the selection
// stay, a move made in the Drawn view lands on the clicked hex, pan and zoom
// never re-bake the landscape, and the choice survives a reload.
import { expect, test, type Page } from '@playwright/test';
import { MENU_TEST, activeUnitOfType, clickButton, clickHex, key, reachable, startFromMenu, state, unit, waitIdle } from './helpers';

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]] as const;
const DRAWN = '🗺 Drawn view';
const STANDARD = '🗺 Standard view';

const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** Everything a toggle must leave alone. */
async function snapshot(page: Page) {
  // The play clock (`elapsedMs`) runs on its own; every other field must hold.
  const { elapsedMs: _clock, ...rest } = await state(page);
  return {
    state: rest,
    zoom: await page.evaluate(() => window.__heraklios.cameraZoom()),
    scroll: await page.evaluate(() => window.__heraklios.cameraScroll()),
    selected: await page.evaluate(() => window.__heraklios.selectedUnitId()),
  };
}

async function toggle(page: Page, label: string, kind: 'standard' | 'drawn') {
  await clickButton(page, label);
  await page.waitForFunction((k) => window.__heraklios.boardView() === k, kind);
  await frames(page);
}

test('the view toggle keeps state, camera and selection, and a move works in the Drawn view', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  expect(await page.evaluate(() => window.__heraklios.boardView())).toBe('standard');

  const mover = await activeUnitOfType(page, 'fantassins');
  const reach = await reachable(page, mover.id);
  const to = DIRS.map(([dq, dr]) => ({ q: mover.position.q + dq, r: mover.position.r + dr })).find((h) => reach.includes(key(h)));
  expect(to, 'an adjacent reachable hex').toBeTruthy();

  await clickHex(page, mover.position);
  await waitIdle(page);
  const before = await snapshot(page);
  expect(before.selected, 'the unit is selected').toBe(mover.id);

  await toggle(page, DRAWN, 'drawn');
  expect(await snapshot(page)).toEqual(before);
  expect(await page.evaluate(() => window.__heraklios.displayListSorted()), 'depth-sorted in the Drawn view').toBe(true);
  const builds = await page.evaluate(() => window.__heraklios.landscapeBuilds());
  expect(builds).toBeGreaterThanOrEqual(1);

  // A land move by a canvas click on the hex centre, in the Drawn view.
  await clickHex(page, to!);
  await waitIdle(page);
  expect((await unit(page, mover.id)).position).toEqual(to);
  await frames(page); // the display list is sorted on the next render
  expect(await page.evaluate(() => window.__heraklios.displayListSorted()), 'depth-sorted after the move').toBe(true);

  // Zoom with the wheel and pan with a drag: the camera moves, nothing is baked again.
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + 700, box.y + 350);
  await page.mouse.wheel(0, -300);
  await frames(page);
  expect(await page.evaluate(() => window.__heraklios.cameraZoom())).toBeGreaterThan(before.zoom);
  const scrolled = await page.evaluate(() => window.__heraklios.cameraScroll());
  await page.mouse.down();
  await page.mouse.move(box.x + 600, box.y + 300, { steps: 5 });
  await page.mouse.up();
  await frames(page);
  expect(await page.evaluate(() => window.__heraklios.cameraScroll())).not.toEqual(scrolled);
  expect(await page.evaluate(() => window.__heraklios.landscapeBuilds()), 'pan and zoom do not re-bake').toBe(builds);

  await waitIdle(page);
  const drawn = await snapshot(page);
  await toggle(page, STANDARD, 'standard');
  expect(await snapshot(page)).toEqual(drawn);
  expect(await page.evaluate(() => window.__heraklios.displayListSorted()), 'depth-sorted back in Standard').toBe(true);

  // The choice is remembered: Drawn again, reload, start again.
  await toggle(page, DRAWN, 'drawn');
  await page.reload();
  await page.waitForFunction((l) => window.__heraklios?.buttonCount(l) === 1, MENU_TEST);
  await clickButton(page, MENU_TEST);
  await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  await waitIdle(page);
  expect(await page.evaluate(() => window.__heraklios.boardView())).toBe('drawn');
  expect(errors).toEqual([]);
});
