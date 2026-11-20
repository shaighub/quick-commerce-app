import { expect, test } from '@playwright/test';
import { addProduct, signup, uniqueEmail } from './helpers.js';

test('quantity updates and remove change the cart total', async ({ page }) => {
  await signup(page, uniqueEmail('cart'));
  await addProduct(page, 'Amul Butter');
  await expect(page.getByText(/81\.00/)).toBeVisible();
  await page.getByRole('button', { name: 'Increase quantity of Amul Butter' }).click();
  await expect(page.getByText('Amul Butter quantity is now 2.')).toBeVisible();
  await expect(page.getByText(/137\.00/)).toBeVisible();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart (1)' })).toHaveCount(0);
});
