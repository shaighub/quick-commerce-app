import { expect, test } from '@playwright/test';
import { addProduct, ORDER_NUMBER, placeOrder, signup, uniqueEmail } from './helpers.js';

test('the customer sees only the order they placed, with the price paid', async ({ page }) => {
  await signup(page, uniqueEmail('orders'));
  await addProduct(page, 'Amul Taaza Milk');
  await page.getByRole('link', { name: 'Checkout' }).click();
  const number = await placeOrder(page);
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
  await page.getByRole('link', { name: number }).click();
  await expect(page.getByRole('heading', { name: 'Order detail' })).toBeVisible();
  await expect(page.getByText(ORDER_NUMBER).first()).toHaveText(number);
  await expect(page.getByRole('heading', { name: 'Status history' })).toBeVisible();
  await expect(page.getByText('Status: Confirmed')).toBeVisible();
  await expect(page.getByText(/28\.00/)).toBeVisible();
  await expect(page.getByText(/53\.00/)).toBeVisible();
});
