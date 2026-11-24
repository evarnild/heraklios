// §73 characterisation: how the Board settles a land attack's consequences -
// the advance offer, the exchange loss, a retreat and a push, an elephant's
// drift with a trample, the guards while a question is open, and a computer
// attacker against a human defender. Written against the scene before it
// settled combats through the engine session, and unchanged by that move (but
// for the one case the intent amends, O3: a larger-than-needed exchange
// selection is refused).
//
// Each scenario loads a crafted position (`combatFixtures.ts`, not test mode,
// so a die roll clears the undo history), seeds the dice just before the
// attack (`combatScenarios.ts`; `combatScenarios.test.ts` checks the seeds
// against the engine), and plays by clicks. It asserts the questions asked, the
// log lines and the final positions, never the roll alone.
import { expect, test, type Page } from '@playwright/test';
import { messagesFor } from '../src/ui/i18n/index';
import {
  MENU_CLOSE_COMBAT,
  chord,
  clickButton,
  clickHex,
  startFromMenu,
  state,
  unit,
  waitIdle,
  type Hex,
} from './helpers';
import { loadFixture } from './combatFixtures';
import { ADVANCE, COMPUTER_ATTACKS, DRIFT, EXCHANGE, ONE_OPTION, PUSH, type Scenario } from './combatScenarios';
import { acquireSaveLock, withSaveLockHeld } from './savesDir';

const en = messagesFor('en');
const unitName = (typeId: string): string => (en.units as Record<string, string>)[typeId]!;
const DEFENDER = unitName('cavalerie-legere');
const hexAt = (q: number, r: number): Hex => ({ q, r });

test.beforeEach(async () => {
  await acquireSaveLock(); // the fixtures use a save slot
});
test.afterEach(() => withSaveLockHeld(() => {}));

/** Starts the Combat test mode board, then replaces its units with the scenario's. */
async function begin(page: Page, scenario: Scenario, seedBeforeLoad = false): Promise<string[]> {
  const errors = await startFromMenu(page, MENU_CLOSE_COMBAT, 'close-combat', 1);
  const base = await state(page);
  await loadFixture(page, base, scenario.fixture, seedBeforeLoad ? () => page.evaluate((n) => window.__heraklios.seed(n), scenario.seed) : undefined);
  return errors;
}

/** Builds the attack by clicks and presses Resolve attack. */
async function attack(page: Page, scenario: Scenario): Promise<void> {
  const st = await state(page);
  const hexOf = (id: string) => st.units.find((u) => u.id === id)!.position;
  for (const id of scenario.attackerIds) await clickHex(page, hexOf(id));
  await clickHex(page, hexOf(scenario.defenderIds[0]!));
  // Seeded last: building the attack (and the animations around it) draw from `Math.random` too.
  await page.evaluate((n) => window.__heraklios.seed(n), scenario.seed);
  await clickButton(page, 'Resolve attack');
}

async function lines(page: Page): Promise<string[]> {
  const entries = await page.evaluate(() => window.__heraklios.logEntries());
  return entries.filter((e) => e.kind === 'entry').flatMap((e) => e.text.split('\n'));
}

/** Every text appears, in this order (other lines may sit between). */
function expectInOrder(all: string[], wanted: string[]): void {
  let from = 0;
  for (const text of wanted) {
    const at = all.indexOf(text, from);
    expect(at, `"${text}" after position ${from} in the log:\n${all.join('\n')}`).toBeGreaterThanOrEqual(from);
    from = at + 1;
  }
}

/** The Board scene restarts when a game is loaded; until it is back the hook throws, which is "not yet". */
const waitChoice = (page: Page, kind: 'retreat' | 'pushTarget') =>
  page.waitForFunction((k) => {
    try {
      return window.__heraklios.pendingChoice()?.kind === k;
    } catch {
      return false;
    }
  }, kind);
const choice = (page: Page) => page.evaluate(() => window.__heraklios.pendingChoice());
const waitButton = (page: Page, label: string) => page.waitForFunction((l) => window.__heraklios.buttonCount(l) === 1, label);
const unitHex = async (page: Page, id: string) => (await unit(page, id)).position;

async function declineAdvance(page: Page): Promise<void> {
  await waitButton(page, "Don't advance");
  await clickButton(page, "Don't advance");
  await waitIdle(page);
}

test('(a) a retreat, then the advance offer: the attacker takes the vacated hex', async ({ page }) => {
  const errors = await begin(page, ADVANCE);
  await attack(page, ADVANCE);
  await waitChoice(page, 'retreat');
  const asked = (await choice(page))!;
  expect(asked.hexes).toHaveLength(3);
  expect(await page.evaluate(() => window.__heraklios.busy())).toContain('retreatChoice');
  await clickHex(page, asked.hexes[1]!);

  const advanceA = en.board.advanceUnit('A', unitName('phalanges'));
  await waitButton(page, "Don't advance");
  await waitButton(page, advanceA);
  await clickButton(page, advanceA);
  await waitIdle(page);

  expect(await unitHex(page, 'fx-def')).toEqual(asked.hexes[1]);
  expect(await unitHex(page, 'fx-att')).toEqual(hexAt(10, 4));
  expectInOrder(await lines(page), [en.log.mustRetreat(DEFENDER), en.log.retreats(DEFENDER), en.log.advances(unitName('phalanges'))]);
  expect(errors).toEqual([]);
});

test('(f) a retreat with one hex still waits for the click, and declining the advance leaves the attacker', async ({ page }) => {
  const errors = await begin(page, ONE_OPTION);
  await attack(page, ONE_OPTION);
  await waitChoice(page, 'retreat');
  const asked = (await choice(page))!;
  expect(asked.hexes).toEqual([hexAt(9, 4)]);
  await page.waitForTimeout(300);
  expect(await choice(page), 'still waiting for the human').not.toBeNull();
  await clickHex(page, asked.hexes[0]!);

  await declineAdvance(page);
  expect(await unitHex(page, 'fx-def')).toEqual(hexAt(9, 4));
  expect(await unitHex(page, 'fx-att')).toEqual(hexAt(10, 5));
  expect(errors).toEqual([]);
});

test('(b) an exchange: a selection below the force is refused, a minimal one is lost, then the advance offers', async ({ page }) => {
  const errors = await begin(page, EXCHANGE);
  await attack(page, EXCHANGE);
  const row = (checked: boolean) => en.board.exchangeRow(checked, 'C', unitName('fantassins-lourds'), 4);
  await waitButton(page, en.board.confirmLosses);

  await clickButton(page, en.board.confirmLosses);
  await expect.poll(async () => (await lines(page)).includes(en.log.selectMoreForce(2))).toBe(true);
  expect((await unit(page, 'fx-a3')).destroyed, 'nothing was lost yet').toBe(false);

  await waitButton(page, row(false));
  await clickButton(page, row(false));
  await waitButton(page, row(true));
  await clickButton(page, en.board.confirmLosses);

  const advanceB = en.board.advanceUnit('B', unitName('chars-lourds'));
  await waitButton(page, en.board.advanceUnit('A', unitName('phalanges')));
  await waitButton(page, advanceB);
  expect((await unit(page, 'fx-a3')).destroyed).toBe(true);
  expect((await unit(page, 'fx-a1')).destroyed).toBe(false);
  await clickButton(page, advanceB);
  await waitIdle(page);

  expect((await unit(page, 'fx-def')).destroyed).toBe(true);
  expect(await unitHex(page, 'fx-a2')).toEqual(hexAt(10, 4));
  expect(await unitHex(page, 'fx-a1')).toEqual(hexAt(10, 5));
  expectInOrder(await lines(page), [en.log.exchangeSacrificed([unitName('fantassins-lourds')]), en.log.advances(unitName('chars-lourds'))]);
  expect(errors).toEqual([]);
});

test('(c) a boxed-in defender pushes its friend, who retreats to make room', async ({ page }) => {
  const errors = await begin(page, PUSH);
  await attack(page, PUSH);
  await waitChoice(page, 'pushTarget');
  const friend = unitName('fantassins');
  expect(await choice(page)).toEqual({ kind: 'pushTarget', hexes: [hexAt(10, 3)] });
  expect(await lines(page)).toContain(en.log.nowhereToRetreat(DEFENDER, 1));
  await clickHex(page, hexAt(10, 3));

  await waitChoice(page, 'retreat');
  expect(await choice(page)).toEqual({ kind: 'retreat', hexes: [hexAt(10, 2)] });
  expect(await lines(page)).toContain(en.log.mustRetreatRoom(friend));
  await clickHex(page, hexAt(10, 2));

  await declineAdvance(page);
  expect(await unitHex(page, 'fx-def')).toEqual(hexAt(10, 3));
  expect(await unitHex(page, 'fx-friend')).toEqual(hexAt(10, 2));
  const all = await lines(page);
  expectInOrder(all, [en.log.nowhereToRetreat(DEFENDER, 1), en.log.mustRetreatRoom(friend), en.log.retreatsMakingRoom(friend, DEFENDER)]);
  expect(all.filter((l) => l === en.log.retreats(friend) || l === en.log.retreats(DEFENDER)), 'a pushed link has no "retreats." line').toEqual([]);
  expect(errors).toEqual([]);
});

interface Pause {
  arrow: { hex: Hex; facing: number } | null;
  live: Hex;
  drawnAtLive: boolean;
}

/** What the board shows at a drift's "Continue" pause. */
function observePause(page: Page): Promise<Pause> {
  return page.evaluate(() => {
    const hook = window.__heraklios;
    const live = (hook.state() as { units: { id: string; position: Hex }[] }).units.find((u) => u.id === 'fx-ele')!.position;
    const drawn = hook.unitCanvas('fx-ele');
    const there = hook.hexToCanvas(live);
    return {
      arrow: hook.driftArrow(),
      live,
      drawnAtLive: !!drawn && !!there && Math.abs(drawn.x - there.x) < 2 && Math.abs(drawn.y - there.y) < 2,
    };
  });
}

type Stop = 'continue' | 'retreat' | 'pushTarget' | 'advance' | 'idle';

async function nextStop(page: Page): Promise<Stop> {
  const handle = await page.waitForFunction((): Stop | false => {
    const hook = window.__heraklios;
    if (hook.buttonCount('▶ Continue') === 1) return 'continue';
    const asked = hook.pendingChoice();
    if (asked) return asked.kind;
    if (hook.buttonCount("Don't advance") === 1) return 'advance';
    return hook.idle() ? 'idle' : false;
  });
  return (await handle.jsonValue()) as Stop;
}

// What the unchanged scene showed, per pause (`DRIFT`, seed 9: the elephant at
// (10,4) drifts north, tramples the infantry at (10,2), and goes on to (10,0)).
// The arrow's facing 2 is north in `DIRECTIONS`.
const DRIFT_PAUSES: { live: Hex; facing: number | undefined }[] = [
  { live: hexAt(10, 4), facing: undefined },
  { live: hexAt(10, 3), facing: 2 },
  { live: hexAt(10, 3), facing: 2 },
  { live: hexAt(10, 3), facing: 2 },
  { live: hexAt(10, 2), facing: 2 },
  { live: hexAt(10, 2), facing: 2 },
  { live: hexAt(10, 1), facing: 2 },
  { live: hexAt(10, 0), facing: 2 },
  { live: hexAt(10, 0), facing: 2 },
];
const DRIFT_STOPS: Stop[] = [
  ...Array<Stop>(4).fill('continue'), // drift started, direction rolled, moved, the trample
  'retreat',
  ...Array<Stop>(5).fill('continue'), // the elephant enters the vacated hex, moves twice more, stops
  'advance',
];

test('(d) a drift: one Continue per beat showing the board at that beat, and the trampled unit retreats without a "must retreat" line', async ({ page }) => {
  const errors = await begin(page, DRIFT);
  await attack(page, DRIFT);

  const pauses: Pause[] = [];
  const stops: Stop[] = [];
  for (let stop = await nextStop(page); stop !== 'idle'; stop = await nextStop(page)) {
    stops.push(stop);
    if (stop === 'continue') {
      pauses.push(await observePause(page));
      await clickButton(page, '▶ Continue');
    } else if (stop === 'advance') {
      await clickButton(page, "Don't advance");
    } else {
      await clickHex(page, (await choice(page))!.hexes[0]!);
    }
  }

  // Every beat's drawn figure is where the live state has it, and the elephant ends where the engine put it.
  expect(pauses.every((p) => p.drawnAtLive), JSON.stringify(pauses)).toBe(true);
  expect(await unitHex(page, 'fx-ele')).toEqual(hexAt(10, 0));
  expect(pauses.map((p) => ({ live: p.live, facing: p.arrow?.facing }))).toEqual(DRIFT_PAUSES);
  // The trampled unit's retreat prompt came after the beat of the trample.
  expect(stops).toEqual(DRIFT_STOPS);

  const all = await lines(page);
  const victim = unitName('fantassins-lourds');
  expectInOrder(all, [en.log.tramples(unitName('elephants'), victim, 10, 2), en.log.retreats(victim)]);
  expect(all, 'a trample has no "must retreat" line').not.toContain(en.log.mustRetreat(victim));
  expect(errors).toEqual([]);
});

/** Undo (Ctrl+Z), Save/Load and End phase each log their "resolve the pending ..." line and do nothing else. */
async function expectRefusals(page: Page): Promise<void> {
  const before = await state(page);
  const said = (text: string) => expect.poll(async () => (await lines(page)).includes(text)).toBe(true);
  await chord(page, ['Control'], 'z');
  await said(en.log.resolvePendingUndo);
  await clickButton(page, '💾 Save / Load');
  await said(en.log.resolvePendingSave);
  await clickButton(page, 'End phase');
  await said(en.log.resolvePendingPhase);
  expect(await page.evaluate(() => window.__heraklios.buttonCount('Save')), 'no Save/Load panel opened').toBe(0);
  const after = await state(page);
  expect(after.phase).toBe(before.phase);
  expect(after.activePlayerIndex).toBe(before.activePlayerIndex);
}

test('(e) while a retreat is asked, Undo, Save/Load and End phase are refused', async ({ page }) => {
  const errors = await begin(page, ADVANCE);
  await attack(page, ADVANCE);
  await waitChoice(page, 'retreat');
  await expectRefusals(page);
  expect(await choice(page), 'the question is still open').not.toBeNull();
  await clickHex(page, (await choice(page))!.hexes[0]!);
  await declineAdvance(page);
  expect(errors).toEqual([]);
});

test("(e) at a drift's Continue pause the same three are refused", async ({ page }) => {
  const errors = await begin(page, DRIFT);
  await attack(page, DRIFT);
  await waitButton(page, '▶ Continue');
  await expectRefusals(page);
  await waitButton(page, '▶ Continue');
  expect(errors).toEqual([]);
});

test('(e) after the combat settles, a die was rolled so there is nothing to undo', async ({ page }) => {
  const errors = await begin(page, ADVANCE);
  await attack(page, ADVANCE);
  await waitChoice(page, 'retreat');
  await clickHex(page, (await choice(page))!.hexes[0]!);
  await declineAdvance(page);
  await chord(page, ['Control'], 'z');
  await expect.poll(async () => (await lines(page)).includes(en.log.nothingToUndo)).toBe(true);
  expect(errors).toEqual([]);
});

test('(g) a computer attacker, a human defender: the human is asked while the computer runs, then play goes on', async ({ page }) => {
  const errors = await begin(page, COMPUTER_ATTACKS, true);
  await waitChoice(page, 'retreat');
  expect(await page.evaluate(() => window.__heraklios.busy())).toEqual(expect.arrayContaining(['aiRunning', 'retreatChoice']));
  const asked = (await choice(page))!;
  expect(asked.hexes).toHaveLength(3);
  await clickHex(page, asked.hexes[0]!);
  await waitIdle(page, 30_000);

  expect(await unitHex(page, 'fx-def')).toEqual(asked.hexes[0]);
  expect((await state(page)).phase, 'the computer finished its turn').toBe('movement');
  expect(errors).toEqual([]);
});
