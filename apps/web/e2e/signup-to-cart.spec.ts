import { expect, test } from '@playwright/test';
import { addProduct, logout, signup, uniqueEmail } from './helpers.js';

test('sign up returns to the shop and the chosen item is in the cart', async ({ page }) => {
  const email = uniqueEmail('signup');
  await addProduct(page, 'Amul Butter');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.locator('#main').getByRole('link', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/signup\?next=/);
  await page.getByLabel('Name').fill('Asha Rao');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Password1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('link', { name: 'Cart (1)' })).toBeVisible();
  await page.getByRole('link', { name: 'Cart (1)' }).click();
  await expect(page.getByRole('heading', { name: 'Amul Butter', level: 2 })).toBeVisible();
});

test('a duplicate email says the account already exists', async ({ page }) => {
  const email = uniqueEmail('dup');
  await signup(page, email);
  await logout(page);
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await page.goto('/signup');
  await page.getByLabel('Name').fill('Asha Rao');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Password1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
});
