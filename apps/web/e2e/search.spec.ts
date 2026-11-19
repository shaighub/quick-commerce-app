import { expect, test } from '@playwright/test';
import { openShop } from './helpers.js';

test('guest can browse categories and search, including a small typo', async ({ page }) => {
  await openShop(page);
  await expect(page.getByRole('button', { name: 'Dairy & Bread' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Amul Taaza Milk', level: 2 })).toBeVisible();
  await page.getByLabel('Search products').fill('Amul Butter');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/search\?/);
  await expect(page.getByRole('heading', { name: 'Amul Butter', level: 2 })).toBeVisible();

  await page.getByLabel('Search products').fill('amul buter');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('heading', { name: 'Amul Butter', level: 2 })).toBeVisible();

  await page.goto('/p/amul-butter-500g');
  await expect(page.getByRole('heading', { name: 'Amul Butter', level: 1 })).toBeVisible();
  await expect(page.getByText('500 g')).toBeVisible();
  await expect(page.getByText(/56\.00/)).toBeVisible();
});
