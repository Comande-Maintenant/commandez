import { expect, test } from '@playwright/test';

for (const [type, label, product] of [['epicerie','Épicerie','Panier de fruits'], ['fleuriste','Fleuriste','Bouquet']] as const) {
  test(`${type} publishes a real catalogue through the free owner flow`, async ({ page }) => {
    const id = '26102300-0000-4000-8000-000000000091';
    const user = { id, email: 'owner@example.test', email_confirmed_at: new Date().toISOString(), user_metadata: { role: 'owner' } };
    const jwt = `${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.test`;
    await page.addInitScript(({user,jwt}) => {
      localStorage.setItem('cm_language','fr');
      localStorage.setItem('commandeici_auth',JSON.stringify({access_token:jwt,refresh_token:'fixture-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
      if (location.hostname === 'commandeici.com' || location.hostname.endsWith('.commandeici.com')) {
        document.cookie = 'commandeici_auth=' + encodeURIComponent(localStorage.getItem('commandeici_auth')!) + '; path=/; secure; samesite=lax';
      }
    },{user,jwt});
    const creation: Array<Record<string, any>> = []; const billing: string[] = [];
    await page.route(url => ['/auth/v1/','/rest/v1/','/functions/v1/'].some(prefix => url.pathname.startsWith(prefix)), async route => {
      const path = new URL(route.request().url()).pathname;
      if (/stripe|checkout|billing|portal|validate-promo/.test(path)) billing.push(path);
      if (path.endsWith('/auth/v1/user')) return route.fulfill({json:user});
      if (path.endsWith('/owners')) return route.fulfill({json:{id}});
      if (path.endsWith('/customer_profiles')) return route.fulfill({json:{id,email:user.email,name:'Fixture owner',phone:null}});
      if (path.endsWith('/rpc/complete_onboarding')) {
        const body = route.request().postDataJSON(); creation.push(body);
        return route.fulfill({json:{id:'26102300-0000-4000-8000-000000000092',slug:'fixture-shop',name:'Mon commerce',created:true}});
      }
      if (path.endsWith('/send-welcome-email')) return route.fulfill({json:{skipped:true,reason:'fixture_no_send'}});
      return route.fulfill({json:[]});
    });
    await page.goto(`/inscription?commerce=${type}&lang=fr`);
    await expect(page.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');
    await page.getByLabel('Nom du commerce',{exact:true}).fill('Mon commerce');
    await page.getByLabel('Adresse',{exact:true}).fill('12 rue des Fleurs');
    await page.getByLabel('Ville',{exact:true}).fill('Auxerre');
    await page.getByRole('button',{name:'Continuer',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Vos produits',exact:true})).toBeVisible();
    await page.getByLabel('Nom du produit',{exact:true}).fill(product);
    await page.getByLabel('Prix (€)',{exact:true}).fill('25,50');
    const creationKey = await page.evaluate(() => localStorage.getItem('commandeici_creation_key'));
    await page.reload();
    await expect(page.getByLabel('Nom du produit',{exact:true})).toHaveValue(product);
    await expect(page.getByLabel('Prix (€)',{exact:true})).toHaveValue('25,50');
    expect(await page.evaluate(() => localStorage.getItem('commandeici_creation_key'))).toBe(creationKey);
    await page.getByRole('button',{name:'Valider le catalogue',exact:true}).click();
    await page.getByRole('button',{name:'Continuer',exact:true}).click();
    await page.getByRole('button',{name:'Publier mon établissement',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Votre commerce est en ligne',exact:true})).toBeVisible();
    expect(creation).toHaveLength(1);
    expect(creation[0].p_restaurant.business_type).toBe(type);
    expect(creation[0].p_menu).toEqual([expect.objectContaining({name:product,price:25.5,product_type:'simple'})]);
    expect(creation[0].p_defaults).toEqual({});
    expect(billing).toEqual([]);
  });
}
