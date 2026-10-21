// §36: the language switch, by real clicks — the Menu buttons, the stored
// choice across a reload, the French Board, the page `lang` and the
// browser-locale default (intents/36-e2e-language-scenario/spec.md).
import { expect, test, type Page } from '@playwright/test';
import { en } from '../src/ui/i18n/en';
import { fr } from '../src/ui/i18n/fr';
import { clickButton, collectErrors, waitIdle } from './helpers';

const STORE_KEY = 'heraklios.language';

const buttonCount = (page: Page, label: string) => page.evaluate((l) => window.__heraklios?.buttonCount(l) ?? 0, label);
const lang = (page: Page) => page.evaluate(() => document.documentElement.lang);
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), STORE_KEY);

async function waitForLabel(page: Page, label: string, count = 1): Promise<void> {
  await page.waitForFunction(([l, n]) => window.__heraklios?.buttonCount(l as string) === n, [label, count] as const);
}

/** The Menu reads in `language`, and the page and the store agree. */
async function expectMenuIn(page: Page, language: 'en' | 'fr'): Promise<void> {
  const [shown, other] = language === 'fr' ? [fr, en] : [en, fr];
  await waitForLabel(page, shown.menu.testMode);
  expect(await buttonCount(page, other.menu.testMode)).toBe(0);
  expect(await lang(page)).toBe(language);
}

test('the Menu switch changes the language and a reload keeps it', async ({ page }) => {
  expect(fr.menu.testMode, 'the tables differ, so a French check cannot pass on English').not.toBe(en.menu.testMode);
  const errors = collectErrors(page);

  // Pin English once, before the first real load. An init script would re-pin
  // on the reload and hide a switch that is not remembered.
  await page.goto('/');
  await page.evaluate(([k]) => localStorage.setItem(k!, 'en'), [STORE_KEY]);
  await page.goto('/');
  await expectMenuIn(page, 'en');
  expect(await buttonCount(page, fr.languageNames.fr)).toBe(1);

  await clickButton(page, fr.languageNames.fr);
  await expectMenuIn(page, 'fr');
  expect(await stored(page)).toBe('fr');

  await page.reload();
  await expectMenuIn(page, 'fr');
  expect(await stored(page)).toBe('fr');

  await clickButton(page, fr.menu.testMode);
  await page.waitForFunction(() => window.__heraklios.scenes().includes('Board'));
  await waitIdle(page);
  expect(await buttonCount(page, fr.board.endPhase), 'the Board draws French').toBe(1);

  await page.reload();
  await expectMenuIn(page, 'fr');
  await clickButton(page, en.languageNames.en);
  await expectMenuIn(page, 'en');
  expect(await stored(page)).toBe('en');
  expect(errors).toEqual([]);
});

for (const [locale, language] of [['fr-FR', 'fr'], ['en-US', 'en']] as const) {
  test.describe(`browser locale ${locale}`, () => {
    test.use({ locale });
    test('a first visit follows the browser language', async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto('/');
      expect(await stored(page)).toBeNull();
      await expectMenuIn(page, language);
      expect(errors).toEqual([]);
    });
  });
}
