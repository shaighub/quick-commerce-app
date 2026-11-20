import { expect, test, type Page } from '@playwright/test';
import { ORDER_NUMBER, uniqueEmail } from './helpers.js';

async function tabTo(page: Page, selector: string): Promise<void> {
  for (let step = 0; step < 80; step += 1) {
    const active = await page.evaluate(
      (target) => document.activeElement?.matches(target) ?? false,
      selector,
    );
    if (active) {
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab did not reach ${selector}`);
}

test('a customer can search, add, and check out with the keyboard', async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail('keys');
  await page.goto('/signup');
  await tabTo(page, '#name');
  await page.keyboard.type('Asha Rao');
  await tabTo(page, '#email');
  await page.keyboard.type(email);
  await tabTo(page, '#password');
  await page.keyboard.type('Password1');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Account: Asha Rao')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Amul Butter', level: 2 })).toBeVisible();
  await tabTo(page, '#search');
  const outline = await page
    .locator('#search')
    .evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.type('Amul Butter');
  await page.keyboard.press('Enter');
  await expect(page.getByText('1 products')).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();

  await page.getByRole('link', { name: 'Checkout' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await page.locator('#name').focus();
  await page.keyboard.type('Asha Rao');
  await page.locator('#phone').focus();
  await page.keyboard.type('9876543210');
  await page.locator('#line1').focus();
  await page.keyboard.type('12 Residency Road');
  await page.locator('#city').focus();
  await page.keyboard.type('Bengaluru');
  await page.locator('#state').focus();
  await page.keyboard.type('Karnataka');
  await page.locator('#pincode').focus();
  await page.keyboard.type('560001');
  await expect(page.getByText('We deliver to 560001.')).toBeVisible();
  await page.getByRole('button', { name: 'Place order' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(ORDER_NUMBER)).toBeVisible();
});
