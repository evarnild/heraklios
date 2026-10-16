// Spec B6: from "Mode test", move a land unit one hex by canvas clicks.
import { expect, test } from '@playwright/test';
import { MENU_TEST, activeUnitOfType, clickHex, hexShot, key, reachable, startFromMenu, state, unit, waitIdle } from './helpers';

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]] as const;

test('a land unit moves one hex', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  expect((await state(page)).phase).toBe('movement');

  const mover = await activeUnitOfType(page, 'fantassins');
  const reach = await reachable(page, mover.id);
  const to = DIRS.map(([dq, dr]) => ({ q: mover.position.q + dq, r: mover.position.r + dr })).find((h) => reach.includes(key(h)));
  expect(to, 'an adjacent reachable hex').toBeTruthy();

  const fromBefore = await hexShot(page, mover.position);
  const toBefore = await hexShot(page, to!);
  // A screenshot taken twice with nothing happening is byte-identical, so "changed" below means something.
  expect((await hexShot(page, mover.position)).equals(fromBefore)).toBe(true);

  await clickHex(page, mover.position);
  await clickHex(page, to!);
  await waitIdle(page);

  expect((await unit(page, mover.id)).position).toEqual(to);
  expect((await hexShot(page, mover.position)).equals(fromBefore), 'source hex redrawn').toBe(false);
  expect((await hexShot(page, to!)).equals(toBefore), 'destination hex redrawn').toBe(false);
  expect(errors).toEqual([]);
});
