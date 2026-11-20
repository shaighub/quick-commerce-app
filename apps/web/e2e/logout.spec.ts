import { expect, test } from '@playwright/test';
import { signup, uniqueEmail } from './helpers.js';

test('log out clears the session and protected pages ask for log in', async ({ page }) => {
  await signup(page, uniqueEmail('logout'));
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto('/');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('log out everywhere ends the other browser on reload', async ({ browser }) => {
  const email = uniqueEmail('logout-all');
  const first = await browser.newContext();
  const second = await browser.newContext();
  const pageA = await first.newPage();
  const pageB = await second.newPage();
  try {
    await signup(pageA, email);
    await pageB.goto('/login');
    await pageB.getByLabel('Email').fill(email);
    await pageB.getByLabel('Password').fill('Password1');
    await pageB.getByRole('button', { name: 'Log in' }).click();
    await expect(pageB.getByText('Account: Asha Rao')).toBeVisible();
    await pageA.getByRole('button', { name: 'Log out everywhere' }).click();
    await expect(pageA.getByRole('link', { name: 'Log in' })).toBeVisible();
    await pageB.reload();
    await expect(pageB.getByRole('link', { name: 'Log in' })).toBeVisible();
  } finally {
    await first.close();
    await second.close();
  }
});
