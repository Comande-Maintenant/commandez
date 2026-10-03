import {expect,test} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>{localStorage.setItem('cm_onboarding_done_demo','true');localStorage.setItem('cm_onboarding_done_antalya-kebab-moneteau','true');});});
test('sample order alert fits iPhone and its state survives polling without a server mutation',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 let mutations=0;
 await page.route(url=>/\/rpc\/(advance_demo_order|update_order_status|update_order_items)$/.test(url.pathname),async route=>{mutations++;await route.fulfill({status:400,json:{message:'Local sample must not write to server'}});});
 await page.goto('/admin/demo?view=cuisine&lang=fr',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Recevoir une commande',exact:true}).click();
 const alert=page.getByRole('dialog',{name:'Nouvelle commande !'});
 await expect(alert).toBeVisible();
 const box=await alert.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(844);
 await expect(alert.getByRole('button',{name:'Voir la commande'})).toBeVisible();
 await page.keyboard.press('Escape');await expect(alert).toBeHidden();
 await page.getByRole('button',{name:'Accepter',exact:true}).last().click();
 await expect(page.getByText('Client de démonstration',{exact:true}).first()).toBeVisible();
 await page.waitForTimeout(5600);
 await expect(page.getByRole('button',{name:/Prêt|Prête|Terminer/}).last()).toBeVisible();
 await page.reload({waitUntil:"networkidle"});
 await expect(page.getByText("Client de démonstration",{exact:true}).first()).toBeVisible();
 await expect(page.getByRole("button",{name:/Prêt|Prête|Terminer/}).last()).toBeVisible();
 await page.getByRole('button',{name:/Prêt|Prête|Terminer/}).last().click();
 await page.getByRole('button',{name:'Caisse',exact:true}).click();
 await page.getByRole('button',{name:/A encaisser/}).click();
 await expect(page.getByText('Client de démonstration',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Encaisse',exact:true}).last().click();
 await page.reload({waitUntil:'networkidle'});
 await page.getByRole('button',{name:/A encaisser/}).click();
 await expect(page.getByRole('button',{name:'Encaisse',exact:true})).toHaveCount(0);
 expect(mutations).toBe(0);
});
test('menu photographs are immediately visible, bundled, and show the add affordance on touch',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/demo?lang=fr',{waitUntil:'networkidle'});
 const kebab=page.getByRole('button',{name:/^Kebab/}).first();
 await kebab.scrollIntoViewIfNeeded();
 const photo=kebab.locator('[data-menu-media] img');
 await expect(photo).toBeVisible();
 await expect(photo).toHaveAttribute('src',/\/images\/menu\/kebab.webp|^https:/);
 expect(await photo.evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
 await expect(kebab.locator('svg').last()).toBeVisible();
 expect(await kebab.evaluate(element=>getComputedStyle(element.parentElement!).opacity)).toBe('1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}]){
 test(`POS footer stays above navigation at ${viewport.width}x${viewport.height}`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.goto('/e2e/fixtures/pos.html?lang=fr',{waitUntil:'networkidle'});
  await expect(page.getByTestId('pos-viewport')).toBeVisible();
  const next=page.getByRole('button',{name:'Suivant',exact:true});
  const footer=await next.boundingBox();const nav=await page.locator('[data-dashboard-nav]').boundingBox();
  expect(footer!.y+footer!.height).toBeLessThanOrEqual(nav!.y);
  expect(footer!.x+footer!.width).toBeLessThanOrEqual(viewport.width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await next.click();await expect(page.getByRole('status')).toHaveText('Étape suivante');
 });
}
test('opening a received order moves keyboard focus into the complete native-sized detail',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/admin/demo?view=cuisine&lang=fr',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Recevoir une commande',exact:true}).click();
 await page.getByRole('dialog',{name:'Nouvelle commande !'}).getByRole('button',{name:'Voir la commande'}).click();
 const detail=page.getByRole('dialog',{name:/^(CB-|#)/});await expect(detail).toBeVisible();
 expect(await detail.evaluate(element=>element.contains(document.activeElement))).toBe(true);
 const accept=detail.getByRole('button',{name:/Accepter/}).last();await expect(accept).toBeVisible();
 const rect=await accept.boundingBox();expect(rect!.y+rect!.height).toBeLessThanOrEqual(844);
 await detail.getByRole('button',{name:'Fermer',exact:true}).click();await expect(detail).toBeHidden();
});
for(const view of ['page','stats']){
 test(`${view} dashboard has no hidden horizontal overflow on iPhone`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto(`/admin/demo?view=${view}&lang=fr`,{waitUntil:'networkidle'});
  await expect(page.locator('main')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(view==='page') for(const input of await page.locator('input[type="color"]').all()) {const box=await input.boundingBox();expect(box!.width).toBeLessThanOrEqual(44);expect(box!.height).toBeLessThanOrEqual(44);}
  if(view==='stats')await expect(page.getByRole('tab',{name:'Ce mois',exact:true})).toBeVisible();
 });
}
