// §84: the Tables panel stays available while a combat is being resolved. On
// §73's crafted positions: the panel is open through a retreat, an advance,
// an exchange and a drift; a click on a tab, the panel or the Tables button, or
// Escape, never answers the question; the advance and exchange choosers sit
// below the panel; and the Land combat tab marks the cell the roll landed on
// until the next attack is built.
import { expect, test, type Page } from '@playwright/test';
import { messagesFor } from '../src/ui/i18n/index';
import { MENU_CLOSE_COMBAT, chord, clickButton, clickHex, frames, startFromMenu, state, waitIdle } from './helpers';
import { loadFixture } from './combatFixtures';
import { DRIFT, EXCHANGE, ONE_OPTION, type Scenario } from './combatScenarios';
import { acquireSaveLock, withSaveLockHeld } from './savesDir';

const en = messagesFor('en');
const tabs = en.rules.tabs;
/** ONE_OPTION plus a spare attacker far away, to start the next attack with. */
const WITH_SPARE: Scenario = {
  ...ONE_OPTION,
  fixture: { ...ONE_OPTION.fixture, units: [...ONE_OPTION.fixture.units, { id: 'fx-spare', owner: 0, typeId: 'phalanges', at: { q: 13, r: 5 } }] },
};
/** The seeds' dice (`combatScenarios.test.ts` checks them against the engine): ONE_OPTION rolls a 2, EXCHANGE a 5. */
const DIE = { one: 2, exchange: 5 };

test.beforeEach(async () => {
  await acquireSaveLock();
});
test.afterEach(() => withSaveLockHeld(() => {}));

async function begin(page: Page, scenario: Scenario): Promise<string[]> {
  const errors = await startFromMenu(page, MENU_CLOSE_COMBAT, 'close-combat', 1);
  await loadFixture(page, await state(page), scenario.fixture);
  return errors;
}

async function attack(page: Page, scenario: Scenario): Promise<void> {
  const st = await state(page);
  const hexOf = (id: string) => st.units.find((u) => u.id === id)!.position;
  for (const id of scenario.attackerIds) await clickHex(page, hexOf(id));
  await clickHex(page, hexOf(scenario.defenderIds[0]!));
  await page.evaluate((n) => window.__heraklios.seed(n), scenario.seed);
  await clickButton(page, 'Resolve attack');
}

const panel = (page: Page) => page.evaluate(() => window.__heraklios.rulesPanel());
const choice = (page: Page) => page.evaluate(() => window.__heraklios.pendingChoice());
const waitRetreat = (page: Page) =>
  page.waitForFunction(() => {
    try {
      return window.__heraklios.pendingChoice()?.kind === 'retreat';
    } catch {
      return false;
    }
  });
const waitButton = (page: Page, label: string) => page.waitForFunction((l) => window.__heraklios.buttonCount(l) === 1, label);
const buttonY = async (page: Page, label: string) => (await page.evaluate((l) => window.__heraklios.buttonToCanvas(l), label)).y;

async function clickCanvasAt(page: Page, x: number, y: number): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + x, box.y + y);
}

/** Opens the panel and picks `tab`. */
async function openOn(page: Page, tab: string): Promise<void> {
  await clickButton(page, en.board.tables);
  await clickButton(page, tab);
}

test('the panel stays open and on its tab through a retreat, and nothing on it answers the question (AC1, AC2, AC4)', async ({ page }) => {
  const errors = await begin(page, ONE_OPTION);
  await openOn(page, tabs.terrain);
  await attack(page, ONE_OPTION);
  await waitRetreat(page);
  const asked = (await choice(page))!;
  expect(await panel(page), 'open and on the same tab, never auto-changed').toMatchObject({ open: true, tab: 'terrain' });

  // A tab, the panel body and the Tables button leave the question pending.
  await clickButton(page, tabs.land);
  expect((await panel(page)).tab).toBe('land');
  await clickButton(page, tabs.terrain);
  expect((await panel(page)).tab).toBe('terrain');
  await clickCanvasAt(page, 700, 140);
  expect(await choice(page), 'a click on the panel body').toEqual(asked);
  await clickButton(page, en.board.tables);
  expect((await panel(page)).open, 'the Tables button closes it').toBe(false);
  expect(await choice(page)).toEqual(asked);
  await clickButton(page, en.board.tables);
  expect(await panel(page)).toMatchObject({ open: true, tab: 'terrain' });

  // Escape closes the panel only.
  await page.keyboard.press('Escape');
  await frames(page);
  expect((await panel(page)).open).toBe(false);
  expect(await choice(page), 'Escape did not answer').toEqual(asked);
  expect((await state(page)).units.find((u) => u.id === 'fx-def')!.position, 'nobody moved').toEqual({ q: 10, r: 4 });

  await clickHex(page, asked.hexes[0]!);
  await waitButton(page, "Don't advance");
  await clickButton(page, "Don't advance");
  await waitIdle(page);
  expect((await panel(page)).open, 'the panel was not re-opened by the result').toBe(false);
  expect(errors).toEqual([]);
});

test('a closed panel stays closed through the decision (AC2)', async ({ page }) => {
  const errors = await begin(page, ONE_OPTION);
  await attack(page, ONE_OPTION);
  await waitRetreat(page);
  expect((await panel(page)).open).toBe(false);
  await clickHex(page, (await choice(page))!.hexes[0]!);
  await waitButton(page, "Don't advance");
  expect((await panel(page)).open).toBe(false);
  await clickButton(page, "Don't advance");
  await waitIdle(page);
  expect(errors).toEqual([]);
});

test('the rolled cell stays marked after the roll and is cleared by the next attack (AC5); the advance chooser sits below the open panel', async ({ page }) => {
  const errors = await begin(page, WITH_SPARE);
  await openOn(page, tabs.land);
  await attack(page, WITH_SPARE);
  await waitRetreat(page);
  expect((await panel(page)).highlight!.rolled, 'row = face with no modifier').toEqual({ face: DIE.one, row: DIE.one });
  await clickHex(page, (await choice(page))!.hexes[0]!);
  await waitButton(page, "Don't advance");
  // One candidate: a 102-high box whose top is 286 (below the panel's area), its decline button 20 above the bottom.
  expect(await buttonY(page, "Don't advance"), 'the advance chooser is below the panel').toBe(286 + 102 - 20);
  expect(await panel(page)).toMatchObject({ open: true, tab: 'land' });
  await clickButton(page, "Don't advance");
  await waitIdle(page);

  const kept = (await panel(page)).highlight!;
  expect(kept.rolled, 'kept after the selection was cleared').toEqual({ face: DIE.one, row: DIE.one });

  // Starting another attack (a new attacker) drops the mark.
  await clickHex(page, (await state(page)).units.find((u) => u.id === 'fx-spare')!.position);
  await page.waitForFunction(() => window.__heraklios.rulesPanel().highlight === null);
  expect(errors).toEqual([]);
});

/** Rolls ONE_OPTION with the Tables panel on the land tab, declines the advance, and leaves the roll marked. */
async function rollAndSettle(page: Page): Promise<void> {
  await openOn(page, tabs.land);
  await attack(page, ONE_OPTION);
  await waitRetreat(page);
  await clickHex(page, (await choice(page))!.hexes[0]!);
  await waitButton(page, "Don't advance");
  await clickButton(page, "Don't advance");
  await waitIdle(page);
  expect((await panel(page)).highlight, 'the roll is still marked').not.toBeNull();
}

test('ending the phase drops the rolled mark (B7)', async ({ page }) => {
  const errors = await begin(page, ONE_OPTION);
  await rollAndSettle(page);
  await clickButton(page, 'End phase');
  await waitIdle(page);
  await page.waitForFunction(() => window.__heraklios.rulesPanel().highlight === null);
  expect(errors).toEqual([]);
});

test('a load drops the rolled mark (B8)', async ({ page }) => {
  const errors = await begin(page, ONE_OPTION);
  await rollAndSettle(page);
  await loadFixture(page, await state(page), ONE_OPTION.fixture);
  await waitIdle(page);
  expect((await panel(page)).highlight).toBeNull();
  expect(errors).toEqual([]);
});

test('on an exchange the rolled cell is marked while the chooser is open, below the panel (AC5, B4)', async ({ page }) => {
  const errors = await begin(page, EXCHANGE);
  await openOn(page, tabs.land);
  await attack(page, EXCHANGE);
  await waitButton(page, en.board.confirmLosses);
  expect((await panel(page)).highlight!.rolled).toEqual({ face: DIE.exchange, row: DIE.exchange });
  expect(await panel(page)).toMatchObject({ open: true, tab: 'land' });
  // Three attackers: a 182-high box whose top is 286, its confirm button 16 above the bottom.
  expect(await buttonY(page, en.board.confirmLosses), 'the exchange chooser is below the panel').toBe(286 + 182 - 16);
  // Escape closes the panel and leaves the chooser.
  await page.keyboard.press('Escape');
  await frames(page);
  expect((await panel(page)).open).toBe(false);
  expect(await page.evaluate((l) => window.__heraklios.buttonCount(l), en.board.confirmLosses)).toBe(1);
  expect(errors).toEqual([]);
});

test("at a drift's Continue pause the panel opens, closes and takes Escape without continuing; Space continues (AC4)", async ({ page }) => {
  const errors = await begin(page, DRIFT);
  await attack(page, DRIFT);
  await waitButton(page, '▶ Continue');
  const arrow = () => page.evaluate(() => window.__heraklios.driftArrow());
  const before = await arrow();
  await clickButton(page, en.board.tables);
  await clickButton(page, tabs.boarding);
  await page.keyboard.press('Escape');
  await clickButton(page, en.board.tables);
  await clickButton(page, en.board.tables);
  await frames(page);
  expect(await arrow(), 'no pause was skipped').toEqual(before);
  await waitButton(page, '▶ Continue');
  await clickButton(page, en.board.tables); // open, then Space continues with it open
  expect((await panel(page)).open).toBe(true);
  await chord(page, [], 'Space');
  await page.waitForFunction((b) => JSON.stringify(window.__heraklios.driftArrow()) !== b, JSON.stringify(before));
  expect((await panel(page)).open, 'the pause moving on did not touch the panel').toBe(true);
  expect(errors).toEqual([]);
});
