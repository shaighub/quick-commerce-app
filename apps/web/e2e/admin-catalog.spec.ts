import { expect, test } from '@playwright/test';
import { loginAdmin } from './helpers.js';

test('an admin can create, update, and delete catalog rows', async ({ page }) => {
  const stamp = Date.now().toString().slice(-6);
  const category = `M5 Cat ${stamp}`;
  const emptyCategory = `M5 Empty ${stamp}`;
  const subcategory = `M5 Sub ${stamp}`;
  const product = `M5 Paneer ${stamp}`;

  await loginAdmin(page);
  await page.goto('/admin/categories');
  await expect(page.getByRole('heading', { name: 'Dairy & Bread', level: 2 })).toBeVisible();

  await page.locator('#category-name').fill(category);
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByRole('heading', { name: category, level: 2 })).toBeVisible();

  await page.locator('#category-name').fill(emptyCategory);
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByRole('heading', { name: emptyCategory, level: 2 })).toBeVisible();

  await page.locator('#sub-parent').selectOption({ label: category });
  await page.locator('#sub-name').fill(subcategory);
  await page.getByRole('button', { name: 'Add subcategory' }).click();
  await expect(page.getByRole('heading', { name: subcategory, level: 3 })).toBeVisible();

  await page.getByRole('button', { name: `Delete ${emptyCategory}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: emptyCategory, level: 2 })).toHaveCount(0);

  await page.goto('/admin/products/new');
  await page.getByLabel('Name').fill(product);
  await page.getByLabel('SKU').fill(`M5-${stamp}`);
  await page.getByLabel('Subcategory').selectOption({ label: subcategory });
  await page.getByLabel('Price (₹)').fill('10');
  await page.getByLabel('Unit').fill('200 g');
  await page.getByLabel('Stock').fill('8');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  await page.getByLabel('Search').fill(product);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('heading', { name: product, level: 2 })).toBeVisible();

  await page.goto('/');
  await page.getByLabel('Search products').fill(product);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('heading', { name: product, level: 2 })).toBeVisible();

  await page.goto('/admin/products');
  await page.getByLabel('Search').fill(product);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('link', { name: `Edit ${product}` }).click();
  await expect(page.getByRole('heading', { name: 'Edit product' })).toBeVisible();
  await page.getByLabel('Stock').fill('9');
  await page.getByRole('button', { name: 'Save product' }).click();
  await page.getByLabel('Search').fill(product);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Stock 9')).toBeVisible();

  await page.getByRole('button', { name: `Delete ${product}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: product, level: 2 })).toHaveCount(0);

  await page.goto(`/search?q=${encodeURIComponent(product)}&sort=newest`);
  await expect(page.getByText(/No results/)).toBeVisible();
});
