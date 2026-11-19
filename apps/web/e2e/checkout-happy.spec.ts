import { expect, test } from '@playwright/test';
import { addProduct, fillCheckout, ORDER_NUMBER, signup, uniqueEmail } from './helpers.js';

test('checkout shows an order number, the items, the total, and the address', async ({ page }) => {
  await signup(page, uniqueEmail('pay'));
  await addProduct(page, 'Amul Taaza Milk');
  await page.getByRole('link', { name: 'Checkout' }).click();
  await fillCheckout(page);
  await expect(page.getByText('We deliver to 560001.')).toBeVisible();
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmation' })).toBeVisible();
  await expect(page.getByText(ORDER_NUMBER)).toBeVisible();
  await expect(page.getByText(/Amul Taaza Milk/)).toBeVisible();
  await expect(page.getByText(/53\.00/)).toBeVisible();
  await expect(page.getByText(/12 Residency Road/)).toBeVisible();
  await expect(page.getByText(/Bengaluru/)).toBeVisible();
  await expect(page.getByText(/560001/)).toBeVisible();
});
