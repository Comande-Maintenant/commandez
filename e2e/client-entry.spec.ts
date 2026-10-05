import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const languages: Record<string, Record<string, string>> = Object.fromEntries(['fr', 'en', 'ar'].map(language => [language, JSON.parse(readFileSync(new URL('../src/i18n/' + language + '.json', import.meta.url), 'utf8'))]));
const empty = { items: [], has_more: false };
const fixture = { slug: 'mock-directory-shop', name: 'Mock directory shop', city: 'Évreux', image: null, cover_image: null, cuisine: null, cuisine_type: null, business_type: 'fleuriste' };
for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 844 }, { width: 960, height: 844 }, { width: 844, height: 390 }]) for (const [language, messages] of Object.entries(languages)) {
 test(`dual entry fits ${viewport.width}x${viewport.height} in ${language} with reduced motion`, async ({ page }, info) => {
  await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?lang=${language}`);
  const client = page.getByRole('button', { name: messages['entry.client_action'], exact: true });
  const merchant = page.getByRole('button', { name: messages['entry.merchant_action'], exact: true });
  await expect(client).toBeVisible(); await expect(merchant).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const action of [client, merchant]) { const rect = (await action.boundingBox())!; expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height); expect(rect.height).toBeGreaterThanOrEqual(48); }
  if (language === 'ar') await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.locator('.entry-welcome').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.screenshot({ path: info.outputPath(`entry-home-${language}-${viewport.width}.png`), fullPage: true });
 });
}
test('city is required and no GPS, auth or directory request occurs before submission', async ({ page }, info) => {
 let calls = 0; await page.route('**/rest/v1/rpc/list_public_commerces_by_city', route => { calls++; return route.fulfill({ json: empty }); });
 await page.goto('/espace/client?lang=fr');
 await page.getByRole('button', { name: 'Voir les commerces', exact: true }).click();
 await expect(page.getByRole('textbox', { name: 'Ville', exact: true })).toHaveAttribute('aria-invalid', 'true');
 expect(calls).toBe(0);
 await page.getByRole('textbox', { name: 'Ville', exact: true }).fill('Auxerre');
 await page.screenshot({ path: info.outputPath('city-required.png'), fullPage: true });
});
test('successful empty city can be changed and copied through deliberate sharing', async ({ page }, info) => {
 await page.addInitScript(() => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as unknown as { copiedLink: string }).copiedLink = text; } } });
 });
 await page.route('**/rest/v1/rpc/list_public_commerces_by_city', route => route.fulfill({ json: empty }));
 await page.goto('/espace/client?lang=fr'); await page.getByRole('textbox', { name: 'Ville', exact: true }).fill('Auxerre'); await page.getByRole('button', { name: 'Voir les commerces', exact: true }).click();
 await expect(page.getByText('Oups, pas encore de commerce à Auxerre.', { exact: true })).toBeVisible();
 expect(await page.evaluate(() => (window as unknown as { copiedLink?: string }).copiedLink)).toBeUndefined();
 await page.getByRole('button', { name: 'Faire découvrir CommandeIci', exact: true }).click(); await expect(page.getByText('Lien copié', { exact: true })).toBeVisible();
 expect(await page.evaluate(() => (window as unknown as { copiedLink: string }).copiedLink)).toContain('https://commandeici.com');
 await page.screenshot({ path: info.outputPath('city-empty-mocked.png'), fullPage: true });
 await page.getByRole('button', { name: 'Changer de ville', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'Ville', exact: true })).toBeVisible();
});
test('network failure is an error and retry is manual', async ({ page }, info) => {
 let calls = 0; await page.route('**/rest/v1/rpc/list_public_commerces_by_city', route => { calls++; return route.fulfill({ status: 503, json: { message: 'Mocked outage' } }); });
 await page.goto('/espace/client?lang=fr'); await page.getByRole('textbox', { name: 'Ville', exact: true }).fill('Paris'); await page.getByRole('button', { name: 'Voir les commerces', exact: true }).click();
 await expect(page.getByText('Impossible de charger les commerces. Réessayez.', { exact: true })).toBeVisible(); await expect(page.getByText(/Oups, pas encore/)).toHaveCount(0);
 expect(calls).toBe(1); await page.screenshot({ path: info.outputPath('city-error-mocked.png'), fullPage: true });
 await page.getByRole('button', { name: 'Réessayer', exact: true }).click(); await expect.poll(() => calls).toBe(2);
});
test('positive directory fixtures show real slug links and public category without claiming open', async ({ page }, info) => {
 await page.route('**/rest/v1/rpc/list_public_commerces_by_city', async route => { expect(route.request().postDataJSON()).toEqual({ p_city: 'Evreux' }); await route.fulfill({ json: { items: [fixture], has_more: false } }); });
 await page.goto('/espace/client?lang=fr'); await page.getByRole('textbox', { name: 'Ville', exact: true }).fill('Evreux'); await page.getByRole('button', { name: 'Voir les commerces', exact: true }).click();
 const shop = page.getByRole('link', { name: /Mock directory shop/ }); await expect(shop).toHaveAttribute('href', '/mock-directory-shop'); await expect(shop).toContainText('Fleuriste'); await expect(shop).toContainText('Retrait sur place');
 await expect(page.getByText(/Ouvert|Open now/)).toHaveCount(0); await page.screenshot({ path: info.outputPath('city-positive-MOCK-FIXTURE.png'), fullPage: true });
});
test('changing city during a slow search ignores its late result', async ({ page }) => {
 let release!: () => void;
 await page.route('**/rest/v1/rpc/list_public_commerces_by_city', async route => {
  if (route.request().postDataJSON().p_city === 'Paris') await new Promise<void>(resolve => { release = resolve; });
  await route.fulfill({ json: empty }).catch(() => {});
 });
 await page.goto('/espace/client?lang=fr'); await page.getByRole('textbox', { name: 'Ville', exact: true }).fill('Paris'); await page.getByRole('button', { name: 'Voir les commerces', exact: true }).click();
 await expect(page.getByRole('status')).toContainText('Recherche'); await page.getByRole('button', { name: 'Changer de ville', exact: true }).click();
 await page.getByRole('textbox', { name: 'Ville', exact: true }).fill('Auxerre'); await page.getByRole('button', { name: 'Voir les commerces', exact: true }).click();
 await expect(page.getByText('Oups, pas encore de commerce à Auxerre.')).toBeVisible(); release(); await expect(page.getByText(/commerce à Paris/)).toHaveCount(0);
});
test('both mode switches and role reset remain available with saved city', async ({ page }) => {
 await page.route('**/rest/v1/rpc/list_public_commerces_by_city', route => route.fulfill({ json: empty }));
 await page.goto('/?lang=fr'); await page.getByRole('button', { name: 'Trouver un commerce et commander', exact: true }).click();
 await page.getByRole('textbox', { name: 'Ville', exact: true }).fill('Auxerre'); await page.getByRole('button', { name: 'Voir les commerces', exact: true }).click(); await expect(page.getByText('Oups, pas encore de commerce à Auxerre.')).toBeVisible();
 await page.getByRole('button', { name: 'Espace commerçant', exact: true }).click(); await expect(page.getByText('CommandeIci n’organise pas de livraison.', { exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Espace client', exact: true }).click(); await expect(page.getByText('Oups, pas encore de commerce à Auxerre.')).toBeVisible();
 await page.getByRole('button', { name: 'Changer de parcours', exact: true }).click(); await expect(page.getByRole('button', { name: 'Je suis commerçant', exact: true })).toBeVisible();
});
test('saved client mode does not intercept a direct demo menu or order tracking link', async ({ page }) => {
 await page.addInitScript(() => { localStorage.setItem('commandeici.entry.v1', JSON.stringify({ role: 'client', city: 'Auxerre' })); });
 await page.goto('/demo?lang=fr'); await expect(page.getByRole('button', { name: /^Kebab/ }).first()).toBeVisible(); await expect(page.getByRole('textbox', { name: 'Ville', exact: true })).toHaveCount(0);
 await page.goto('/suivi/demo-local-missing?lang=fr'); await expect(page.getByRole('textbox', { name: 'Ville', exact: true })).toHaveCount(0); await expect(page).toHaveURL(/\/suivi\/demo-local-missing/);
});
test('a merchant demo can switch to customer browsing without an account mutation', async ({ page }) => {
 let writes = 0; await page.route(url => /\/auth\/v1\/logout|\/rest\/v1\/(restaurants|owners)/.test(url.pathname), async route => { if (!['GET', 'HEAD'].includes(route.request().method())) writes++; await route.fulfill({ json: [] }); });
 await page.goto('/admin/demo?lang=fr'); await page.getByRole('button', { name: 'Espace client', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'Ville', exact: true })).toBeVisible(); expect(writes).toBe(0);
});
