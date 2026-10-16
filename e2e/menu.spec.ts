import { expect, test } from '@playwright/test';

test('the Menu loads with no page error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
