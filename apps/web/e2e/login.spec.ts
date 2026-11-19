import { expect, test } from '@playwright/test';
import { CUSTOMER_PASSWORD, login, logout, signup, uniqueEmail } from './helpers.js';

test('wrong credentials show one generic message and valid credentials sign in', async ({
  page,
}) => {
  const email = uniqueEmail('login');
  await signup(page, email);
  await logout(page);
  await login(page, email, 'Wrongpass1');
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect');
  await login(page, email, CUSTOMER_PASSWORD);
  await expect(page.getByText('Account: Asha Rao')).toBeVisible();
});

test('five failures lock the account without revealing that the email exists', async ({ page }) => {
  const email = uniqueEmail('lock');
  await signup(page, email);
  await logout(page);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await login(page, email, 'Wrongpass1');
    await expect(page.getByRole('alert')).toBeVisible();
  }
  await login(page, email, CUSTOMER_PASSWORD);
  await expect(page.getByRole('alert')).toContainText('Too many failed attempts');
  await expect(page.getByRole('alert')).toContainText('15 minutes');
});
