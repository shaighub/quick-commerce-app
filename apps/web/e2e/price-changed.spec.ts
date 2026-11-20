import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  addProduct,
  BUTTER_ID,
  fillCheckout,
  ORDER_NUMBER,
  signup,
  uniqueEmail,
} from './helpers.js';

test('a price change asks the customer to confirm the new total', async ({ page, request }) => {
  const login = await request.post('/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const body = (await login.json()) as { accessToken: string };
  const headers = { authorization: `Bearer ${body.accessToken}` };

  try {
    await signup(page, uniqueEmail('price'));
    await addProduct(page, 'Amul Butter');
    await page.getByRole('link', { name: 'Checkout' }).click();
    await fillCheckout(page);
    await expect(page.getByText('We deliver to 560001.')).toBeVisible();
    await expect(page.getByText(/81\.00/).first()).toBeVisible();

    const raised = await request.patch(`/v1/admin/products/${BUTTER_ID}`, {
      headers,
      data: { pricePaise: 7000 },
    });
    expect(raised.ok()).toBeTruthy();

    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByText(/The total changed from/)).toBeVisible();
    await expect(page.getByText(/₹81\.00/)).toBeVisible();
    await expect(page.getByText('₹95.00', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm new total' }).click();
    await expect(page.getByRole('heading', { name: 'Order confirmation' })).toBeVisible();
    await expect(page.getByText(ORDER_NUMBER)).toBeVisible();
    await expect(page.getByText(/95\.00/)).toBeVisible();
  } finally {
    await request.patch(`/v1/admin/products/${BUTTER_ID}`, {
      headers,
      data: { pricePaise: 5600 },
    });
  }
});
