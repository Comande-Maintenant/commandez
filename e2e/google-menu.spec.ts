import { test, expect } from '@playwright/test';

const id = '10000000-0000-4000-8000-000000000001';
const place = { place_id: 'place-test', name: 'Chez Alice', formatted_address: '1 rue Exemple, 89000 Auxerre, Bourgogne, France', city: 'Auxerre', formatted_phone_number: '0300000000', opening_hours: { weekday_text: ['lundi: 11:00-14:30, 17:30-22:30'] } };

test('owner finds Google listing, retries a provider error, imports a PDF and publishes its structured city and variants', async ({ page }) => {
  const user = { id, email: 'owner@example.test', email_confirmed_at: new Date().toISOString(), user_metadata: { role: 'owner' } };
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.test`;
  await page.addInitScript(({ user, jwt }) => {
    localStorage.setItem('cm_language', 'fr');
    localStorage.setItem('commandeici_auth', JSON.stringify({ access_token: jwt, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user }));
    document.cookie = 'commandeici_auth=' + encodeURIComponent(localStorage.getItem('commandeici_auth')!) + '; path=/; secure; samesite=lax';
  }, { user, jwt });
  let searches = 0, analyses = 0, cleanups = 0;
  let publication: any;
  await page.route((url) => ['/auth/v1/', '/rest/v1/', '/functions/v1/', '/storage/v1/'].some((prefix) => url.pathname.startsWith(prefix)), async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/v1/user')) { await route.fulfill({ json: user }); return; }
    if (path.includes('/owners')) { await route.fulfill({ json: { id } }); return; }
    if (path.includes('/restaurants')) { await route.fulfill({ json: [] }); return; }
    if (path.endsWith('/functions/v1/google-places')) {
      const body = route.request().postDataJSON();
      if (body.action === 'search') {
        searches++;
        await route.fulfill(searches === 1 ? { status: 502, json: { error: 'Google temporarily unavailable' } } : { json: { results: [place] } });
      } else { await route.fulfill({ json: { result: place } }); }
      return;
    }
    if (path.includes('/storage/v1/object/sign/menu-uploads/')) {
      await route.fulfill({ json: { signedURL: `/object/sign/menu-uploads/${id}/carte.pdf?token=fixture` } }); return;
    }
    if (path.includes('/storage/v1/object/menu-uploads')) {
      if (route.request().method() === 'DELETE') cleanups++;
      await route.fulfill({ json: { Key: 'uploaded' } }); return;
    }
    if (path.endsWith('/functions/v1/analyze-menu')) {
      analyses++;
      expect(route.request().postDataJSON().imageUrls[0]).toContain('.pdf?token=');
      await route.fulfill({ json: { categories: [{ name: 'Pizzas', items: [{ name: 'Margherita', price: 9, description: '', variants: [{ name: 'Grande', price: 12 }] }] }] } }); return;
    }
    if (path.endsWith('/rpc/complete_onboarding')) {
      publication = route.request().postDataJSON();
      await route.fulfill({ json: { id: 'restaurant-test', slug: 'chez-alice-auxerre', name: place.name, created: true } }); return;
    }
    await route.fulfill({ json: {} });
  });
  await page.goto('/inscription');
  await expect(page.getByText('Etape 2 sur 6')).toBeVisible();
  await page.getByPlaceholder('Nom de votre restaurant...').fill('Chez Alice Auxerre');
  await page.getByRole('button', { name: 'Rechercher mon établissement' }).click();
  await expect(page.getByRole('alert')).toContainText('La recherche Google est indisponible');
  await page.getByRole('button', { name: 'Rechercher mon établissement' }).click();
  await page.getByRole('button', { name: /Chez Alice.*rue Exemple/ }).click();
  await expect(page.getByRole('textbox').nth(2)).toHaveValue('Auxerre');
  await expect(page.getByText('Lundi : 11:00-14:30, 17:30-22:30')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer ces informations' }).click();
  await expect(page.getByText('Etape 3 sur 6')).toBeVisible();
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'carte.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 fixture') });
  await page.getByRole('button', { name: 'Analyser ma carte', exact: true }).click();
  await page.getByRole('button', { name: 'Valider ma carte', exact: true }).click();
  await expect(page.getByText('Etape 4 sur 6')).toBeVisible();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('button', { name: 'Publier mon établissement', exact: true }).click();
  await expect(page.getByText('https://app.commandeici.com/chez-alice-auxerre', { exact: true })).toBeVisible();
  expect(analyses).toBe(1);
  expect(cleanups).toBe(1);
  expect(publication.p_restaurant.city).toBe('Auxerre');
  expect(publication.p_menu[0].variants).toEqual([{ name: 'Grande', price: 12 }]);
});
