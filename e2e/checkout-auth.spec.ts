import { test, expect } from '@playwright/test';
const restaurantId = '12000000-0000-4000-8000-000000000001';
test('checkout keeps the cart and asks for an account before creating a real order', async ({ page }) => {
  let submitted = 0;
  await page.addInitScript(({ restaurantId }) => {
    localStorage.setItem('cm_language', 'fr');
    localStorage.setItem('resto-order-cart', JSON.stringify({ restaurantId, restaurantSlug: 'chez-alice-paris', items: [{ id: 'cart-pizza', menuItem: { id: 'pizza', name: 'Pizza', price: 12 }, quantity: 1, totalPrice: 12, selectedSauces: [], selectedSupplements: [] }] }));
  }, { restaurantId });
  await page.route(url => /\/(rest|auth|functions)\/v1\//.test(url.pathname), async route => {
    const path = new URL(route.request().url()).pathname;
    if (/place_order/.test(path)) { submitted++; await route.fulfill({ status: 400, json: { message: 'No external write allowed' } }); return; }
    if (path.endsWith('/rpc/get_public_restaurant_by_id')) { await route.fulfill({ json: { id: restaurantId, name: 'Chez Alice', slug: 'chez-alice-paris', is_demo: false, is_open: true, is_accepting_orders: true, subscription_status: 'active', payment_methods: ['cash'] } }); return; }
    if (path.includes('check_customer_ban')) { await route.fulfill({ json: { banned: false } }); return; }
    await route.fulfill({ json: [] });
  });
  await page.goto('/order');
  await page.getByPlaceholder('Votre nom').fill('Client');
  await page.getByPlaceholder('Téléphone').fill('0612345678');
  await page.getByRole('button', { name: /Confirmer/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(submitted).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('resto-order-cart')!).items.length)).toBe(1);
  await expect(page.getByRole('button', { name: /Cr[eé]er.*profil/i })).toBeVisible();
});
