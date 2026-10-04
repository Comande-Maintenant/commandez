import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Exercise the real Capacitor platform selector; business endpoints are never
  // fulfilled with fixtures. Only locally served application assets can load.
  await page.addInitScript(() => {
    (window as unknown as { CapacitorCustomPlatform: {name: string} }).CapacitorCustomPlatform = {name: 'ios'};
    Object.defineProperty(navigator, 'onLine', {get: () => false});
  });
});

test('iOS restaurant menu, configuration, checkout and tracking work with every external request blocked', async ({ page }) => {
  const businessRequests: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    if (/\/rest\/v1\//.test(url.pathname)) businessRequests.push(url.pathname);
    return route.abort();
  });
  await page.goto('/demo?lang=fr', {waitUntil:'domcontentloaded'});
  await page.getByRole('button', {name:/^Assiette/}).first().click();
  await page.getByRole('button', {name:/^Grande assiette/}).click();
  await page.getByRole('button', {name:'Kebab',exact:true}).click();
  const next = page.getByTestId('customizer-next');
  await next.click();
  for (let step=0;step<10 && await page.getByTestId('customizer-add').count()===0;step++) {
    const full=page.getByRole('button',{name:'Complet',exact:true});
    if (await full.isVisible()) await full.click(); else await next.click();
  }
  await page.getByTestId('customizer-add').click();
  await page.getByRole('button',{name:/Voir la commande/}).click();
  await page.getByRole('button',{name:/^Commander/}).click();
  await expect(page).toHaveURL(/\/order$/);
  await expect(page.locator('.native-offline')).toHaveCount(0);
  await page.getByPlaceholder('Votre nom').fill('Démo locale');
  await page.getByPlaceholder('Téléphone', {exact:true}).fill('0612345678');
  await page.getByRole('button',{name:/^Confirmer/}).click();
  await expect(page).toHaveURL(/\/suivi\/demo-local-/);
  await expect(page.getByText('Recu', {exact:true})).toBeVisible();
  expect(businessRequests).toEqual([]);
});

test('iOS dashboard can receive an order and leave empty history without a server', async ({ page }) => {
  const businessRequests: string[] = [];
  await page.route('**/*', route => {
    const url=new URL(route.request().url());
    if (url.hostname==='127.0.0.1'||url.hostname==='localhost') return route.continue();
    if (/\/rest\/v1\//.test(url.pathname)) businessRequests.push(url.pathname);
    return route.abort();
  });
  await page.goto('/admin/demo?lang=fr', {waitUntil:'domcontentloaded'});
  const receive=page.getByRole('button',{name:'Recevoir une commande',exact:true});
  await expect(receive).toBeEnabled();
  await receive.click();
  await expect(page.getByRole('dialog',{name:'Nouvelle commande !'})).toBeVisible();
  await page.getByRole('dialog',{name:'Nouvelle commande !'}).getByRole('button',{name:'Voir la commande'}).click();
  const detail=page.getByRole('dialog',{name:/^(CB-|#)/});
  await detail.getByRole('button',{name:'Fermer',exact:true}).click();
  const history=page.getByRole('button',{name:/Historique/}).first();
  await history.click();
  await expect(page.getByText('Historique (24h)',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Retour',exact:true}).last().click();
  await expect(receive).toBeVisible();
  expect(businessRequests).toEqual([]);
});

for (const sector of ['epicerie','fleuriste']) test(`iOS ${sector} supports the full local journey with external requests blocked`, async ({page}) => {
  const requests:string[]=[];
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'||url.hostname==='localhost')return route.continue();
    if(/\/rest\/v1\//.test(url.pathname))requests.push(url.pathname);
    return route.abort();
  });
  await page.goto(`/demo/${sector}?lang=fr`,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/^(Ajouter|Choisir) /}).first().click();
  await page.getByRole('dialog').getByRole('button',{name:/Ajouter au panier/}).click();
  await page.getByRole('button',{name:/Voir mon panier/}).click();
  await page.getByRole('button',{name:'Simuler la commande'}).click();
  await page.getByRole('button',{name:'Préparer la commande',exact:true}).first().click();
  await page.getByRole('button',{name:'Marquer comme prête',exact:true}).first().click();
  await page.locator('#commerce-tab-cash').click();
  await page.getByRole('button',{name:'Commande retirée',exact:true}).first().click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','4');
  await expect(page.locator('.native-offline')).toHaveCount(0);
  expect(requests).toEqual([]);
});
