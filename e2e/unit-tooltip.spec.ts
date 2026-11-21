// §74: hovering a unit's hex adds the unit's lines to the hover tooltip, in the
// Standard and in the Drawn view; an empty hex keeps its one line. The text is
// read through the dev hook, so it is the tooltip's actual content.
import { expect, test, type Page } from '@playwright/test';
import { MAP_TERRAIN } from '../src/data/map';
import { en } from '../src/ui/i18n/en';
import { MENU_TEST, activeUnitOfType, clickButton, hoverHex, startFromMenu, state, type Hex } from './helpers';

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
