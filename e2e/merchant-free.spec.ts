import { test, expect } from '@playwright/test';

for (const path of ['/abonnement', '/choisir-plan', '/abonnement-confirme']) {
  test(`${path} opens the merchant dashboard without billing`, async ({ page }) => {
    const id = '10000000-0000-4000-8000-000000000001';
    const user = { id, email: 'owner@example.test', email_confirmed_at: new Date().toISOString(), user_metadata: { role: 'owner' } };
    const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.test`;
    await page.addInitScript(({ user, jwt }) => {
      localStorage.setItem('cm_language', 'fr');
      localStorage.setItem('cm_onboarding_done_demo', 'true');
      localStorage.setItem('cm_onboarding_done_antalya-kebab-moneteau', 'true');
      localStorage.setItem('commandeici_auth', JSON.stringify({ access_token: jwt, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user }));
      document.cookie = 'commandeici_auth=' + encodeURIComponent(localStorage.getItem('commandeici_auth')!) + '; path=/; secure; samesite=lax';
    }, { user, jwt });
    const billingRequests: string[] = [];
    await page.route((url) => ['/auth/v1/', '/rest/v1/', '/functions/v1/'].some((prefix) => url.pathname.startsWith(prefix)), async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      if (/subscriptions|stripe-checkout|validate-promo/.test(requestPath)) billingRequests.push(requestPath);
      if (requestPath.endsWith('/auth/v1/user')) { await route.fulfill({ json: user }); return; }
      if (requestPath.endsWith('/restaurants') && route.request().url().includes('owner_id=')) { await route.fulfill({ json: { slug: 'demo' } }); return; }
      await route.fulfill({ json: [] });
    });
    await page.goto(`${path}?lang=fr`);
    await expect(page).toHaveURL(/\/admin\/demo(?:\?|$)/);
    expect(billingRequests).toEqual([]);
  });
}
test('old billing links still require merchant authentication', async ({ page }) => {
  await page.route((url) => ['/auth/v1/', '/rest/v1/', '/functions/v1/'].some((prefix) => url.pathname.startsWith(prefix)), (route) => route.fulfill({ json: {} }));
  await page.goto('/choisir-plan?lang=fr');
  await expect(page).toHaveURL(/\/connexion(?:\?|$)/);
});
