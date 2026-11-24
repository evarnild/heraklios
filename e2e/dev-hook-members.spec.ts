// §75 characterisation: the dev hook exposes exactly these members, each a
// function. Pinned before `installDevHook` was split into builders, so a
// member that is dropped, renamed or added by the split fails here.
import { expect, test } from '@playwright/test';
import { MENU_TEST, startFromMenu } from './helpers';

const MEMBERS = [
  'animationSpeed',
  'armyBuilder',
  'boardObjects',
  'boardView',
  'busy',
  'buttonCount',
  'buttonToCanvas',
  'cameraScroll',
  'cameraZoom',
  'centerOn',
  'displayListSorted',
  'driftArrow',
  'hexToCanvas',
  'hudStrays',
  'idle',
  'landscapeBuilds',
  'logEntries',
  'logPanel',
  'pendingChoice',
  'pendingHexes',
  'placement',
  'reachable',
  'rulesPanel',
  'scenes',
  'scorePanel',
  'seed',
  'selectedUnitId',
  'state',
  'swappable',
  'testScenario',
  'tooltipBox',
  'tooltipText',
  'unitCanvas',
  'viewCentre',
];

test('the dev hook has exactly the pinned members, all functions', async ({ page }) => {
  const errors = await startFromMenu(page, MENU_TEST, 'test', 1);
  const kinds = await page.evaluate(() =>
    Object.fromEntries(Object.entries(window.__heraklios).map(([k, v]) => [k, typeof v])),
  );
  expect(Object.keys(kinds).sort()).toEqual(MEMBERS);
  expect(Object.values(kinds).every((t) => t === 'function')).toBe(true);
  expect(errors).toEqual([]);
});
