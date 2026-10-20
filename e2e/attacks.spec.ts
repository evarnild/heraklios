// Spec B7: from "Combat test mode", one ranged and one melee attack through
// the board's own combat UI. The assertion never depends on the roll: an
// attack that resolved marks its defender `defendedThisPhase`.
//
// The seed only makes a failure replay the same rolls. Whatever they are,
// `settle` answers the retreat, push or advance prompt they raise the way a
// player would (first highlighted hex, "Don't advance"), so the scenario
// never depends on the result.
import { expect, test } from '@playwright/test';
import {
  MENU_CLOSE_COMBAT,
  activeUnitOfType,
  clickButton,
  clickHex,
  key,
  reachable,
  settle,
  startFromMenu,
  state,
  unit,
  waitIdle,
} from './helpers';

const SEED = 1;
// `H32_SEEDS=1,2,3 npm run e2e` runs the scenario once per seed — how SEED was chosen.
const SEEDS = (process.env.H32_SEEDS ?? String(SEED)).split(',').map(Number);

for (const seed of SEEDS) {
test(`a ranged and a melee attack both resolve (seed ${seed})`, async ({ page }) => {
  const errors = await startFromMenu(page, MENU_CLOSE_COMBAT, 'close-combat', seed);
  const st = await state(page);
  expect(st.phase).toBe('movement');
  const me = st.seatOrder[st.activePlayerIndex];
  const enemyAt = (h: { q: number; r: number }) => {
    const e = st.units.find((u) => u.owner !== me && u.position.q === h.q && u.position.r === h.r);
    if (!e) throw new Error(`No enemy at ${key(h)}`);
    return e;
  };
  // Land rows are 2 hexes apart (testMode.ts): own at r, enemy at r ± 2.
  const archers = await activeUnitOfType(page, 'archers');
  const infantry = await activeUnitOfType(page, 'fantassins');
  const step = Math.sign(enemyAt({ q: archers.position.q, r: archers.position.r + 2 * (archers.position.r < 4 ? 1 : -1) }).position.r - archers.position.r);
  const rangedTarget = enemyAt({ q: archers.position.q, r: archers.position.r + 2 * step });
  const meleeTarget = enemyAt({ q: infantry.position.q, r: infantry.position.r + 2 * step });

  // Movement: close the infantry to melee range.
  const closeIn = { q: infantry.position.q, r: infantry.position.r + step };
  expect(await reachable(page, infantry.id)).toContain(key(closeIn));
  await clickHex(page, infantry.position);
  await clickHex(page, closeIn);
  await waitIdle(page);
  expect((await unit(page, infantry.id)).position).toEqual(closeIn);

  await clickButton(page, 'End phase');
  await waitIdle(page);
  expect((await state(page)).phase).toBe('combat');

  // Ranged: archers shoot the unit two hexes away.
  await clickHex(page, archers.position);
  await clickHex(page, rangedTarget.position);
  await clickButton(page, 'Resolve attack');
  await settle(page);
  expect((await unit(page, rangedTarget.id)).defendedThisPhase, 'ranged attack resolved').toBe(true);

  // Melee: the infantry attacks the adjacent unit.
  expect((await unit(page, meleeTarget.id)).defendedThisPhase).toBe(false);
  await clickHex(page, closeIn);
  await clickHex(page, meleeTarget.position);
  await clickButton(page, 'Resolve attack');
  await settle(page);
  expect((await unit(page, meleeTarget.id)).defendedThisPhase, 'melee attack resolved').toBe(true);

  expect(errors).toEqual([]);
});
}
