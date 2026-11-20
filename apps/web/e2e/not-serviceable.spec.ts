import { expect, test } from '@playwright/test';
import { addProduct, fillCheckout, signup, uniqueEmail } from './helpers.js';

test('an unserved pincode is rejected on the shop and at checkout', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Delivery pincode').fill('110001');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('We do not deliver to 110001 yet.')).toBeVisible();
  await page.getByLabel('Delivery pincode').fill('560001');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText(/We deliver to 560001/)).toBeVisible();

  await signup(page, uniqueEmail('pin'));
  await addProduct(page, 'Harvest Bread');
  await page.getByRole('link', { name: 'Checkout' }).click();
  await fillCheckout(page, '110001');
  await expect(page.getByText('We do not deliver to 110001.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Place order' })).toBeDisabled();
});
