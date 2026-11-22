// §74: hovering a unit's hex adds the unit's lines to the hover tooltip, in the
// Standard and in the Drawn view; an empty hex keeps its one line. The text is
// read through the dev hook, so it is the tooltip's actual content.
import { expect, test, type Page } from '@playwright/test';
import { MAP_TERRAIN } from '../src/data/map';
import { DIRECTIONS, hexAdd } from '../src/engine/hex';
import { en } from '../src/ui/i18n/en';
import { getUnitType } from '../src/data/units';
import {
  MENU_TEST, activeUnitOfType, clickButton, clickHex, collectErrors, hoverHex, key, reachable, startFromMenu, state, unit, waitIdle,
  type Hex,
} from './helpers';

const DRAWN = '🗺 Drawn view';
const tooltip = (page: Page) => page.evaluate(() => window.__heraklios.tooltipText());

/** Hovers `hex` and returns the tooltip's lines once its first line names that hex (Phaser handles the move on a later frame). */
async function hoverLines(page: Page, hex: Hex): Promise<string[]> {
  await hoverHex(page, hex);
  const first = `(${hex.q}, ${hex.r}) — `;
  await expect.poll(async () => ((await tooltip(page)) ?? '').startsWith(first), { message: `tooltip for ${hex.q},${hex.r}` }).toBe(true);
  return (await tooltip(page))!.split('\n');
}

/** A hex on the board with no unit on it, one step from `from`. */
async function emptyHexNear(page: Page, from: Hex): Promise<Hex> {
  const st = await state(page);
  for (const [dq, dr] of [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]) {
    const hex = { q: from.q + dq!, r: from.r + dr! };
    if (MAP_TERRAIN.has(`${hex.q},${hex.r}`) && !st.units.some((u) => !u.destroyed && u.position.q === hex.q && u.position.r === hex.r)) return hex;
  }
  throw new Error('no empty neighbour');
}

test('hovering a unit shows its characteristics in both views, an empty hex one line', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const mover = await activeUnitOfType(page, 'fantassins');
  const owner = (await state(page)).players[mover.owner]!;
  const expectedLines = [
    `${en.units.fantassins} — ${owner.name} (${en.colors[mover.owner]})`,
    'attack 2, defense 1, movement 3',
    `movement left ${mover.movementLeft}`,
  ];

  for (const view of ['standard', 'drawn'] as const) {
    if (view === 'drawn') {
      await clickButton(page, DRAWN);
      await page.waitForFunction(() => window.__heraklios.boardView() === 'drawn');
    }
    const bare = await hoverLines(page, await emptyHexNear(page, mover.position));
    expect(bare, `${view}: an empty hex shows one line`).toHaveLength(1);

    const lines = await hoverLines(page, mover.position);
    expect(lines.slice(1), `${view}: the unit's lines`).toEqual(expectedLines);
  }
  expect(errors).toEqual([]);
});

// F1 (review round 1): a unit moved onto the hex under a still pointer must show its lines
// without the pointer moving.
test('a unit that moves onto the hovered hex shows its lines at once', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const mover = await activeUnitOfType(page, 'fantassins');
  const reach = await reachable(page, mover.id);
  const to = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
    .map(([dq, dr]) => ({ q: mover.position.q + dq!, r: mover.position.r + dr! }))
    .find((h) => reach.includes(key(h)))!;
  expect(to, 'an adjacent reachable hex').toBeTruthy();

  await clickHex(page, mover.position);
  await waitIdle(page);
  expect(await hoverLines(page, to), 'the destination is empty').toHaveLength(1);
  await clickHex(page, to); // the pointer stays on `to`
  await waitIdle(page);
  expect((await state(page)).units.find((u) => u.id === mover.id)!.position).toEqual(to);
  await expect.poll(async () => ((await tooltip(page)) ?? '').split('\n').length, { message: 'the unit lines appear with no pointer move' }).toBe(4);
  expect((await tooltip(page))!.split('\n')[1]).toContain(en.units.fantassins);
  expect(errors).toEqual([]);
});

// F7: Placement shows the unit's name and values but no state line (B6).
test('Placement: hovering a placed unit shows no state line', async ({ page }) => {
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

  const { current, legalHexes } = await page.evaluate(() => window.__heraklios.placement());
  const type = getUnitType(current!);
  expect(type.domain).toBe('land');
  await clickHex(page, legalHexes[0]!);
  await page.waitForFunction(() => (window.__heraklios.state() as { units: unknown[] }).units.length === 1);
  const placed = (await state(page)).units[0]!;
  const values = [`attack ${type.attack}`];
  if (type.range > 0) values.push(`ranged ${type.rangedAttack}`, `range ${type.range}`);
  values.push(`defense ${type.defense}`, `movement ${type.movement}`);

  const lines = await hoverLines(page, placed.position);
  expect(lines.slice(1)).toEqual([`${en.units[type.id as keyof typeof en.units]} — ${(await state(page)).players[0]!.name} (${en.colors[0]})`, values.join(', ')]);
  expect(errors).toEqual([]);
});

// N2 (review round 2): the tooltip refreshed by a move must be placed again, so a longer text
// does not run off the right edge.
test('a tooltip refreshed by a move stays inside the viewport', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  // The ships start far from the left edge, where the camera can scroll their hex to the right edge.
  const ship = await activeUnitOfType(page, 'galeres');
  const to = hexAdd(ship.position, DIRECTIONS[ship.facing]!);
  expect(await reachable(page, ship.id), 'the hex ahead is reachable').toContain(key(to));
  await clickHex(page, ship.position);
  await waitIdle(page);

  // Scroll so `to` sits where the one-line tooltip fits to the right of the pointer and the
  // four-line one does not.
  const box = (await page.locator('canvas').boundingBox())!;
  let at: { x: number; y: number } | null = null;
  for (let dq = 1; dq < 40 && !at; dq++) {
    await page.evaluate((h) => window.__heraklios.centerOn(h), { q: to.q - dq, r: to.r });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const pt = await page.evaluate((h) => window.__heraklios.hexToCanvas(h), to);
    if (pt && pt.x > box.width - 260 && pt.x < box.width - 205) at = pt;
  }
  expect(at, 'a scroll that puts the destination near the right edge').toBeTruthy();
  await page.mouse.move(box.x + at!.x - 3, box.y + at!.y);
  await page.mouse.move(box.x + at!.x, box.y + at!.y);
  await expect.poll(async () => ((await tooltip(page)) ?? '').startsWith(`(${to.q}, ${to.r}) — `)).toBe(true);
  expect((await tooltip(page))!.split('\n'), 'the destination is empty').toHaveLength(1);

  await page.mouse.click(box.x + at!.x, box.y + at!.y); // the pointer stays on `to`
  await waitIdle(page);
  expect((await unit(page, ship.id)).position, 'the ship moved ahead').toEqual(to);
  await expect.poll(async () => ((await tooltip(page)) ?? '').split('\n').length).toBe(4);
  const shown = (await page.evaluate(() => window.__heraklios.tooltipBox()))!;
  expect(shown.x + shown.width, 'the tooltip stays inside the viewport').toBeLessThanOrEqual(box.width);
  expect(shown.x).toBeGreaterThanOrEqual(0);
  expect(errors).toEqual([]);
});
