import { expect, test } from '@playwright/test';
import {
  addProduct,
  expectNoSeriousAxeViolations,
  loginAdmin,
  placeOrder,
  signup,
  uniqueEmail,
} from './helpers.js';

test('storefront screens have no serious or critical axe violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Amul Butter', level: 2 })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.goto('/search?q=milk');
  await expect(page.getByRole('heading', { name: 'Amul Taaza Milk', level: 2 })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.goto('/p/amul-butter-500g');
  await expect(page.getByRole('heading', { name: 'Amul Butter', level: 1 })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test('signed-in shopping screens have no serious or critical axe violations', async ({ page }) => {
  await signup(page, uniqueEmail('axe'));
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await addProduct(page, 'Amul Taaza Milk');
  await expectNoSeriousAxeViolations(page);

  await page.getByRole('link', { name: 'Checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  const number = await placeOrder(page);
  await expectNoSeriousAxeViolations(page);

  await page.goto('/orders');
  await expect(page.getByRole('link', { name: number })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.goto(`/orders/${number}`);
  await expect(page.getByRole('heading', { name: 'Status history' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Not allowed' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test('admin screens have no serious or critical axe violations', async ({ page }) => {
  await loginAdmin(page);
  for (const path of ['/admin', '/admin/categories', '/admin/products', '/admin/orders']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  }
  await page.goto('/admin/products/new');
  await expect(page.getByRole('heading', { name: 'New product' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.goto('/admin/products/30000000-0000-4000-8000-000000000002/edit');
  await expect(page.getByLabel('Name')).toHaveValue('Amul Butter');
  await expectNoSeriousAxeViolations(page);
});
