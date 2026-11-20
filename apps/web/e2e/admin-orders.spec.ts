import { expect, test } from '@playwright/test';
import { addProduct, loginAdmin, placeOrder, signup, uniqueEmail } from './helpers.js';

test('an admin can open an order and mark it packed', async ({ page }) => {
  await signup(page, uniqueEmail('adm-order'), 'Order Customer');
  await addProduct(page, 'Classic Chips');
  await page.getByRole('link', { name: 'Checkout' }).click();
  const number = await placeOrder(page);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();

  await loginAdmin(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible();
  await expect(page.getByText('Orders today')).toBeVisible();
  await expect(page.getByText('Revenue today')).toBeVisible();

  await page.goto('/admin/orders');
  await page.getByLabel('Search').fill(number);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('link', { name: number }).click();
  await expect(page.getByRole('heading', { name: 'Admin order' })).toBeVisible();
  await expect(page.getByText('Order Customer')).toBeVisible();
  await page.getByRole('button', { name: 'Mark Packed' }).click();
  await expect(page.getByText('Status updated.')).toBeVisible();
  await expect(page.getByText('Status: Packed')).toBeVisible();
});
