import {expect,test} from '@playwright/test';
for(const language of ['fr','de','ru','ar'])test(`all commerce demonstrations fit 320 pixels in ${language}`,async({page})=>{
 await page.setViewportSize({width:320,height:568});
 for(const path of ['/decouvrir','/demo/epicerie','/demo/fleuriste']){
  await page.goto(`${path}?lang=${language}`,{waitUntil:'networkidle'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const button of await page.getByRole('button').all())expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 }
});
test('discovery offers restaurant, grocery and florist demonstrations',async({page})=>{
 await page.goto('/decouvrir?lang=fr',{waitUntil:'networkidle'});
 for(const name of ['Restauration','Épicerie','Fleuriste'])await expect(page.getByRole('link',{name:new RegExp(name)})).toBeVisible();
});
for(const sector of ['epicerie','fleuriste'])test(`${sector} customer and merchant share a local demo without server writes`,async({page})=>{
 let writes=0;await page.route('**/rest/v1/**',async route=>{if(route.request().method()!=='GET'){writes++;await route.fulfill({status:400,json:{message:'Demo must remain local'}});}else await route.continue();});
 await page.addInitScript(()=>localStorage.setItem('resto-order-cart',JSON.stringify({items:[],restaurantSlug:'actual-owner',restaurantId:'actual-owner'})));
 await page.goto(`/demo/${sector}?lang=fr`,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/^Ajouter /}).first().click();await page.getByRole('button',{name:/Voir mon panier/}).click();
 await page.getByRole('button',{name:'Simuler la commande'}).click();
 const progress=page.getByRole('progressbar');await expect(progress).toHaveAttribute('aria-valuenow','1');
 await page.getByRole('button',{name:'Préparer la commande',exact:true}).first().click();await expect(progress).toHaveAttribute('aria-valuenow','2');
 await page.reload({waitUntil:'networkidle'});await expect(progress).toHaveAttribute('aria-valuenow','2');
 await page.getByRole('button',{name:'Marquer comme prête',exact:true}).first().click();await page.getByRole('button',{name:'Commande retirée',exact:true}).first().click();await expect(progress).toHaveAttribute('aria-valuenow','4');
 expect(writes).toBe(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('resto-order-cart')!).restaurantId)).toBe('actual-owner');
});

for(const path of ['/decouvrir/','/DECOUVRIR','/demo/epicerie/','/demo/fleuriste/','/demo/%65picerie','/demo/%66leuriste','/de%63ouvrir'])test(`${path} remains a local-only demo`,async({page})=>{
 let writes=0;await page.route('**/rest/v1/**',async route=>{if(route.request().method()!=='GET'){writes++;await route.fulfill({status:400,json:{message:'Demo must remain local'}});}else await route.continue();});
 await page.goto(`${path}?lang=fr`,{waitUntil:'networkidle'});await expect(page.getByRole('heading',{level:1})).toBeVisible();expect(writes).toBe(0);
});
test('actor buttons expose their selected view accessibly',async({page})=>{
 await page.goto('/demo/epicerie?lang=fr');const client=page.getByRole('button',{name:'Côté client',exact:true});const merchant=page.getByRole('button',{name:'Côté commerçant',exact:true});await expect(client).toHaveAttribute('aria-pressed','true');await merchant.click();await expect(merchant).toHaveAttribute('aria-pressed','true');await expect(client).toHaveAttribute('aria-pressed','false');
});
