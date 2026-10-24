// §53: the log says when the game autosaves and shows the attack being built.
// From "Combat test mode": `Autosaved.` when the board opens; in the combat
// phase one line per click that changes the attack (attacker alone, then with a
// target and its forces, then cleared); a refused click adds no attack line.
// The expected text comes from the engine (`previewLandAttack`) and the
// message tables, so the numbers are not copied from the code under test.
import { expect, test, type Page } from '@playwright/test';
import { hexDistance } from '../src/engine/hex';
import { previewLandAttack } from '../src/engine/combat';
import { formatAttackLine } from '../src/ui/i18n/format';
import { messagesFor } from '../src/ui/i18n/index';
import {
  MENU_CLOSE_COMBAT,
  activeUnitOfType,
  clickButton,
  clickHex,
  startFromMenu,
  state,
  waitIdle,
} from './helpers';

const en = messagesFor('en');

async function entries(page: Page): Promise<string[]> {
  return (await page.evaluate(() => window.__heraklios.logEntries())).filter((e) => e.kind === 'entry').map((e) => e.text);
}
const attackLines = (all: string[]) => all.filter((t) => t.startsWith('Attack'));

test('the log shows the autosave and the attack being built', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_CLOSE_COMBAT, 'close-combat', 1);
  await page.waitForFunction(() => window.__heraklios.logEntries().some((e) => e.text === 'Autosaved.'));

  await clickButton(page, 'End phase');
  await waitIdle(page);
  const st = await state(page);
  expect(st.phase).toBe('combat');
  const me = st.seatOrder[st.activePlayerIndex];
  const archers = await activeUnitOfType(page, 'archers');
  const enemies = st.units.filter((u) => u.owner !== me && !u.destroyed);
  const target = enemies.find((u) => hexDistance(archers.position, u.position) === 2)!;
  const farEnemy = enemies.find((u) => hexDistance(archers.position, u.position) > 2)!;
  expect(target).toBeTruthy();
  expect(farEnemy).toBeTruthy();
  const archerName = en.units.archers;
  const targetName = (en.units as Record<string, string>)[target.typeId]!;
  const before = attackLines(await entries(page)).length;

  // Select the attacker.
  await clickHex(page, archers.position);
  await page.waitForFunction((n) => window.__heraklios.logEntries().filter((e) => e.text.startsWith('Attack')).length > n, before);
  let lines = attackLines(await entries(page));
  expect(lines.at(-1)).toBe(`Attack: ${archerName}, choose a target.`);

  // A refused click (an enemy it cannot reach) adds no attack line.
  const count = (await entries(page)).length;
  await clickHex(page, farEnemy.position);
  await waitIdle(page);
  const afterRefusal = await entries(page);
  expect(afterRefusal.length).toBeGreaterThan(count); // the refusal itself is logged
  expect(attackLines(afterRefusal)).toEqual(lines);

  // Add the target: both forces, from the engine.
  await clickHex(page, target.position);
  const preview = previewLandAttack([archers], [target]);
  const expected = formatAttackLine([archerName], [targetName], preview, en);
  expect(expected).toMatch(/→/);
  await page.waitForFunction((t) => window.__heraklios.logEntries().some((e) => e.text === t), expected);
  lines = attackLines(await entries(page));
  expect(lines.at(-1)).toBe(expected);

  // Remove the target (still attackers), then the attacker.
  await clickHex(page, target.position);
  await page.waitForFunction(
    (t) => window.__heraklios.logEntries().filter((e) => e.text === t).length >= 1,
    `Attack: ${archerName}, choose a target.`,
  );
  await clickHex(page, archers.position);
  await page.waitForFunction(() => window.__heraklios.logEntries().at(-1)?.text === 'Attack cleared.');


  expect(errors).toEqual([]);
});
