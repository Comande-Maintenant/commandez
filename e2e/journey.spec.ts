import {expect,test} from '@playwright/test';
for(const language of ['de','ru'])test(`long ${language} welcome actions fit 320 pixels`,async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto(`/?lang=${language}`,{waitUntil:'networkidle'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const button of await page.getByRole('button').all())expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
test('a category aligns its heading below navigation before and after sticking',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/demo?lang=fr',{waitUntil:'networkidle'});
 const nav=page.locator('.menu-category-nav');const sections=page.locator('[data-category]');
 const second=sections.nth(1);const category=await second.getAttribute('data-category');
 await nav.getByRole('button',{name:category!,exact:true}).click();
 await expect.poll(async()=>Math.abs((await second.boundingBox())!.y-(await nav.boundingBox())!.y-(await nav.boundingBox())!.height-12)).toBeLessThan(3);
 const first=sections.first();const firstCategory=await first.getAttribute('data-category');
 await nav.getByRole('button',{name:firstCategory!,exact:true}).click();
 await expect.poll(async()=>Math.abs((await first.boundingBox())!.y-(await nav.boundingBox())!.y-(await nav.boundingBox())!.height-12)).toBeLessThan(3);
});
test('owner setup fits a small screen and requires explicit persisted confirmations',async({page})=>{
 await page.route('**/rest/v1/menu_items*',route=>route.fulfill({json:[{id:'fixture-item',enabled:true,product_type:'simple'}]}));
 await page.setViewportSize({width:320,height:568});await page.goto('/e2e/fixtures/merchant-setup.html?lang=fr',{waitUntil:'networkidle'});
 const progress=page.getByRole('progressbar');await expect(progress).toHaveAttribute('aria-valuenow','1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Partager mon lien et mon QR code'}).click();await expect(page.locator('#destination')).toHaveText('qrcodes');await expect(progress).toHaveAttribute('aria-valuenow','1');
 await page.getByRole('checkbox',{name:'J’ai vérifié ma page'}).check();await page.getByRole('checkbox',{name:'J’ai partagé mon lien'}).check();await expect(progress).toHaveAttribute('aria-valuenow','3');
 await page.reload({waitUntil:'networkidle'});await expect(progress).toHaveAttribute('aria-valuenow','3');
 await page.getByRole('button',{name:'Masquer le guide'}).click();await expect(progress).toHaveCount(0);await page.reload({waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Reprendre le guide'}).click();await expect(progress).toHaveAttribute('aria-valuenow','3');
});
test('a reduced-motion customizer opens without a sliding transform',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/demo?lang=fr',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/^Kebab/}).first().click();
 const dialog=page.getByRole('dialog',{name:'Kebab',exact:true});await expect(dialog).toBeVisible();
 expect(await dialog.evaluate(el=>getComputedStyle(el).transform)).toBe('none');
});
test('first launch invites an account-free demo without a blocking tour',async({page})=>{
 await page.goto('/?lang=fr',{waitUntil:'networkidle'});
 const demo=page.getByRole('button',{name:'Tester sans créer de compte'});await expect(demo).toBeVisible();
 await expect(demo).toHaveAttribute('data-primary-action','demo');await demo.click();
 await expect(page).toHaveURL(/\/decouvrir/);await page.getByRole('link',{name:/Restauration/}).click();
 await expect(page.getByRole('progressbar',{name:/première commande/})).toHaveAttribute('aria-valuenow','0');
 await page.waitForTimeout(1200);await expect(page.getByText('1 / 6',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Recevoir une commande',exact:true})).toBeVisible();
});
test('demo guidance follows preparation and cashing after a refresh with no server write',async({page})=>{
 let writes=0;await page.route(url=>/\/rpc\/(advance_demo_order|update_order_status|update_order_items)$/.test(url.pathname),async route=>{writes++;await route.fulfill({status:400,json:{message:'Local sample must not write'}});});
 await page.goto('/admin/demo?lang=fr',{waitUntil:'networkidle'});
 const progress=page.getByRole('progressbar',{name:/première commande/});
 await page.getByRole('button',{name:'Recevoir une commande',exact:true}).click();
 const arrival=page.getByRole('dialog',{name:'Nouvelle commande !'});await expect(arrival).toBeVisible();
 await page.keyboard.press('Escape');await expect(arrival).toBeHidden();
 await expect(progress).toHaveAttribute('aria-valuenow','1');
 await page.getByRole('button',{name:'Accepter',exact:true}).last().click();await expect(progress).toHaveAttribute('aria-valuenow','2');
 await page.reload({waitUntil:'networkidle'});await expect(progress).toHaveAttribute('aria-valuenow','2');
 await page.getByRole('button',{name:/Prêt|Prête|Terminer/}).last().click();await expect(progress).toHaveAttribute('aria-valuenow','3');
 await page.getByRole('button',{name:'Passer en caisse',exact:true}).click();
 await page.getByRole('button',{name:/A encaisser/}).click();await page.getByRole('button',{name:'Encaisse',exact:true}).last().click();
 await expect(progress).toHaveAttribute('aria-valuenow','4');await expect(page.getByRole('link',{name:'Créer ma page gratuitement',exact:true})).toBeVisible();expect(writes).toBe(0);
});
test('menu search supports accents and an empty result can be cleared',async({page})=>{
 await page.goto('/demo?lang=fr',{waitUntil:'networkidle'});
 const search=page.getByRole('searchbox');await search.fill('KÉBAB');
 await expect(page.getByRole('button',{name:/^Kebab/}).first()).toBeVisible();
 await search.fill('zzzz-no-product');await expect(page.getByText('Aucun plat trouvé. Essayez un autre mot.')).toBeVisible();
 await page.getByRole('button',{name:'Effacer la recherche'}).first().click();await expect(search).toHaveValue('');
 await expect(page.getByRole('button',{name:/^Tacos/}).first()).toBeVisible();
});
test('customizer is a labelled modal with a trapped keyboard focus and restores the product trigger',async({page})=>{
 await page.goto('/demo?lang=fr',{waitUntil:'networkidle'});
 const kebab=page.getByRole('button',{name:/^Kebab/}).first();await kebab.click();
 const dialog=page.getByRole('dialog',{name:'Kebab',exact:true});await expect(dialog).toBeVisible();
 for(let index=0;index<12;index++){await page.keyboard.press('Tab');expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
 await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(kebab).toBeFocused();
});
for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}])test(`welcome and demo guidance fit ${viewport.width}x${viewport.height}`,async({page})=>{
 await page.setViewportSize(viewport);await page.goto('/?lang=fr',{waitUntil:'networkidle'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Tester sans créer de compte'}).click();await page.getByRole('link',{name:/Restauration/}).click();
 await expect(page.getByRole('button',{name:'Recevoir une commande',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Arabic discovery and search keep right-to-left direction without overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/?lang=ar',{waitUntil:'networkidle'});await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await page.locator('[data-primary-action="demo"]').click();await page.getByRole('link',{name:/مطعم/}).click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/demo?lang=ar',{waitUntil:'networkidle'});await page.getByRole('searchbox').fill('zzzz-no-product');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
