import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Adminpass1';
export const CUSTOMER_PASSWORD = 'Password1';
export const ORDER_NUMBER = /QC-\d{8}-\d{6}/;
export const BUTTER_ID = '30000000-0000-4000-8000-000000000002';

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@example.com`;
}

export async function signup(page: Page, email: string, name = 'Asha Rao'): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(CUSTOMER_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(`Account: ${name}`)).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

export async function loginAdmin(page: Page): Promise<void> {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toBeVisible();
}

export async function fillCheckout(page: Page, pincode = '560001'): Promise<void> {
  await page.getByLabel('Name', { exact: true }).fill('Asha Rao');
  await page.getByLabel('Mobile number').fill('9876543210');
  await page.getByLabel('Address line 1').fill('12 Residency Road');
  await page.getByLabel('City').fill('Bengaluru');
  await page.getByLabel('State').fill('Karnataka');
  await page.getByLabel('Pincode').fill(pincode);
}

export async function openShop(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Amul Butter', level: 2 })).toBeVisible();
}

export function productCard(page: Page, name: string) {
  return page.getByRole('listitem').filter({ has: page.getByRole('heading', { name, level: 2 }) });
}

/** Guests get a link. Signed-in customers get a button that opens the cart. */
export async function addProduct(page: Page, name: string): Promise<void> {
  await openShop(page);
  const card = productCard(page, name);
  const link = card.getByRole('link', { name: 'Add to cart' });
  if ((await link.count()) > 0) {
    await link.click();
    return;
  }
  await card.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
}

export async function placeOrder(page: Page, pincode = '560001'): Promise<string> {
  await fillCheckout(page, pincode);
  if (pincode === '560001') {
    await expect(page.getByText('We deliver to 560001.')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Place order' }).click();
  const number = page.getByText(ORDER_NUMBER).first();
  await expect(number).toBeVisible();
  const text = await number.textContent();
  const match = text?.match(ORDER_NUMBER);
  if (!match) {
    throw new Error('Order number was not shown');
  }
  return match[0];
}

export async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}
