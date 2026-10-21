// Spec B8: from "Combat test mode", turn a ship once and move it one hex
// forward, by canvas clicks on the board's own Turn buttons and map.
//
// The ships start bow-on to the enemy (testMode.ts), so one step straight
// ahead is a ramming contact — a ram, with dice and prompts, which this
// suite leaves out. The engine's own rules pick a turn whose new forward
// hex is reachable and not a contact.
import { expect, test } from '@playwright/test';
import { DIRECTIONS, hexAdd } from '../src/engine/hex';
import { findRammingContacts, reachableNavalHexes } from '../src/engine/navalMovement';
import { MENU_CLOSE_COMBAT, activeUnitOfType, clickButton, clickHex, key, startFromMenu, state, unit, waitIdle } from './helpers';

/**
 * The Turn buttons, left to right: counter-clockwise on screen (facing +1),
 * then clockwise (facing -1) — BoardScene's rotateCCWBtn / rotateCWBtn. On
 * the flat-top board (hexToPixel: y grows downward) facing 0 points down-right
 * and facing 1 up-right, so a higher facing index is counter-clockwise.
 */
const TURN_INDEX = { [1]: 0, [-1]: 1 } as const;

test('a ship turns once and moves one hex forward', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_CLOSE_COMBAT, 'close-combat', 1);
  const st = await state(page);
  expect(st.phase).toBe('movement');
  const ship = await activeUnitOfType(page, 'galeres');

  const plan = ([1, -1] as const)
    .map((dir) => {
      const trial = structuredClone(st);
      const s = trial.units.find((u) => u.id === ship.id)!;
      s.facing = (s.facing + dir + 6) % 6;
      s.movementLeft -= 1; // a turn costs one movement point
      const forward = hexAdd(s.position, DIRECTIONS[s.facing]!);
      const ok =
        reachableNavalHexes(trial, s).has(key(forward)) &&
        !findRammingContacts(trial, s).some((c) => key(c.hex) === key(forward) && c.facing === s.facing);
      return { dir, facing: s.facing, forward, ok };
    })
    .find((p) => p.ok);
  expect(plan, 'a turn whose forward hex is open water and not a ram').toBeTruthy();

  await clickHex(page, ship.position);
  await waitIdle(page);
  expect(await page.evaluate(() => window.__heraklios.buttonCount('Turn'))).toBe(2);
  // Exercise both buttons first, so each wiring line is covered: left turns
  // counter-clockwise (+1), right turns back clockwise (-1).
  const f0 = ship.facing;
  await clickButton(page, 'Turn', TURN_INDEX[1]);
  await waitIdle(page);
  expect((await unit(page, ship.id)).facing, 'left Turn is counter-clockwise').toBe((f0 + 1) % 6);
  await clickButton(page, 'Turn', TURN_INDEX[-1]);
  await waitIdle(page);
  expect((await unit(page, ship.id)).facing, 'right Turn is clockwise').toBe(f0);

  await clickButton(page, 'Turn', TURN_INDEX[plan!.dir]);
  await waitIdle(page);
  expect((await unit(page, ship.id)).facing, 'the ship turned').toBe(plan!.facing);

  await clickHex(page, plan!.forward);
  await waitIdle(page);
  const after = await unit(page, ship.id);
  expect(after.position, 'the ship moved one hex forward').toEqual(plan!.forward);
  expect(after.facing).toBe(plan!.facing);
  expect(errors).toEqual([]);
});
