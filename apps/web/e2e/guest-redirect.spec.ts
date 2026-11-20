import { expect, test } from '@playwright/test';
import { addProduct, login, logout, signup, uniqueEmail } from './helpers.js';

test('a guest add sends the shopper to log in and the item is added afterwards', async ({
  page,
}) => {
  const email = uniqueEmail('guest');
  await signup(page, email);
  await logout(page);
  await addProduct(page, 'Harvest Bread');
  await expect(page).toHaveURL(/\/login\?next=/);
  await login(page, email, 'Password1');
  await expect(page.getByRole('link', { name: 'Cart (1)' })).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Harvest Bread', level: 2 })).toBeVisible();
});

test('a customer cannot open admin and the admin links stay hidden', async ({ page }) => {
  await signup(page, uniqueEmail('rbac'));
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Not allowed' })).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
});

test('a guest is sent to log in from the cart', async ({ page }) => {
  await page.goto('/cart');
  await expect(page).toHaveURL(/\/login\?next=%2Fcart/);
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});
