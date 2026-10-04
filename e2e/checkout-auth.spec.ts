import { test, expect } from '@playwright/test';
const restaurantId = '12000000-0000-4000-8000-000000000001';
test('late demo defaults respect a focused phone before the customer types', async ({ page }) => {
  let release!: () => void;
  const metadata = new Promise<void>(resolve => { release = resolve; });
  await page.addInitScript(({ restaurantId }) => {
    localStorage.setItem('cm_language', 'fr');
    localStorage.setItem('resto-order-cart', JSON.stringify({ restaurantId, restaurantSlug: 'demo', items: [{ id: 'cart-kebab', menuItem: { id: 'kebab', name: 'Kebab', price: 6.5 }, quantity: 1, totalPrice: 6.5, selectedSauces: [], selectedSupplements: [] }] }));
  }, { restaurantId });
  await page.route(url => /\/(rest|auth|functions)\/v1\//.test(url.pathname), async route => {
    if (new URL(route.request().url()).pathname.endsWith('/rpc/get_public_restaurant_by_id')) {
      await metadata;
      await route.fulfill({ json: { id: restaurantId, name: 'Demo', slug: 'demo', is_demo: true, is_open: true, is_accepting_orders: true } });
    } else await route.fulfill({ json: [] });
  });
  try {
    await page.goto('/order');
    const phone = page.getByPlaceholder('Téléphone');
    await phone.focus();
    release();
    await expect(page.getByPlaceholder('Votre nom')).not.toHaveValue('');
    await expect(phone).toHaveValue('');
    await phone.fill('0612345678');
    await expect(phone).toHaveValue('0612345678');
    await expect(page.getByRole('button', { name: /Confirmer/ })).toBeEnabled();
  } finally { release(); }
});
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
