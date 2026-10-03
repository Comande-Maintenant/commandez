import { expect, test } from '@playwright/test';

for (const failure of ['restaurant', 'menu']) {
  test(`the public catalogue recovers from a failed ${failure} read`, async ({ page }) => {
    let failed = false;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const restaurant = { id: 'restaurant-test', slug: 'chez-alice-paris', name: 'Chez Alice', city: 'Paris', categories: ['Plats'], image: '/images/covers/default.jpg', is_open: true, is_accepting_orders: true, availability_mode: 'manual', account_status: 'active', subscription_status: 'active', primary_color: '#000000', payment_methods: ['cash'], prep_time_config: { default_minutes: 15 }, out_of_stock_ingredients: [] };
    await page.route(url => url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/functions/v1/'), async route => {
      const path = new URL(route.request().url()).pathname;
      const isRestaurant = path.endsWith('/rpc/get_public_restaurant_by_slug');
      const isMenu = path.endsWith('/menu_items');
      if (!failed && ((failure === 'restaurant' && isRestaurant) || (failure === 'menu' && isMenu))) {
        failed = true;
        await route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } }); return;
      }
      await route.fulfill({ json: isRestaurant ? restaurant : isMenu ? [{ id: 'pizza-test', restaurant_id: restaurant.id, name: 'Pizza', price: 12, category: 'Plats', enabled: true, product_type: 'simple' }] : [] });
    });
    await page.goto('/chez-alice-paris?lang=fr');
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(page.getByRole('img', { name: 'Chez Alice', exact: true }).first()).toBeVisible();
    await expect(page.getByText('Pizza', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Réessayer' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const status of ['pending_payment', 'expired', 'cancelled', 'past_due', 'trial']) {
  test(`a merchant remains public with historical billing status ${status}`, async ({ page }) => {
    const restaurant = { id: 'restaurant-test', slug: 'chez-alice-paris', name: 'Chez Alice', city: 'Paris', categories: ['Plats'], image: '/images/covers/default.jpg', is_open: true, is_accepting_orders: true, availability_mode: 'manual', account_status: 'active', subscription_status: status, trial_end_date: '2000-01-01T00:00:00Z', primary_color: '#000000', payment_methods: ['cash'], prep_time_config: { default_minutes: 15 }, out_of_stock_ingredients: [] };
    await page.route(url => url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/functions/v1/'), async route => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({ json: path.endsWith('/rpc/get_public_restaurant_by_slug') ? restaurant : path.endsWith('/menu_items') ? [{ id: 'pizza-test', restaurant_id: restaurant.id, name: 'Pizza', price: 12, category: 'Plats', enabled: true, product_type: 'simple' }] : [] });
    });
    await page.goto('/chez-alice-paris?lang=fr');
    await expect(page.getByRole('button', { name: /^Pizza/ }).first()).toBeVisible();
  });
}
