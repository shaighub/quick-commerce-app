import { expect, test } from '@playwright/test';
import { signup, uniqueEmail } from './helpers.js';

test('the session survives a reload through the same web origin', async ({ page }) => {
  await signup(page, uniqueEmail('reload'));
  await page.reload();
  await expect(page.getByText('Account: Asha Rao')).toBeVisible();
  expect(page.url().startsWith('http://localhost:5173')).toBe(true);
});
