import { expect, test } from '@playwright/test';
import { addProduct, fillCheckout, signup, uniqueEmail } from './helpers.js';

test('a failed payment keeps the cart and offers another try', async ({ page }) => {
  await signup(page, uniqueEmail('fail'));
  await addProduct(page, 'Orange Juice');
  await page.getByRole('link', { name: 'Checkout' }).click();
  await fillCheckout(page);
  await expect(page.getByText('We deliver to 560001.')).toBeVisible();
  await page.getByLabel('Simulate failure').check();
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('alert')).toContainText('Payment failed');
  await expect(page.getByRole('alert')).toContainText('cart is unchanged');
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Orange Juice', level: 2 })).toBeVisible();
});
