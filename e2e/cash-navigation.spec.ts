import {expect,test} from '@playwright/test';
test('a ready demo order calls attention to caisse and opens collection without a second tab click',async({page})=>{
 let writes=0;await page.route(url=>/\/rpc\/(advance_demo_order|update_order_status|update_order_items)$/.test(url.pathname),async route=>{writes++;await route.fulfill({status:400,json:{message:'Local sample must not write'}});});
 await page.goto('/admin/demo?lang=fr',{waitUntil:'networkidle'});
 const cash=page.locator('[data-tour="caisse"]:visible');
 await page.getByRole('button',{name:'Recevoir une commande',exact:true}).click();const arrival=page.getByRole('dialog',{name:'Nouvelle commande !'});await expect(arrival).toBeVisible();await page.keyboard.press('Escape');await expect(arrival).toBeHidden();
 await page.getByRole('button',{name:'Accepter',exact:true}).last().click();
 await expect(cash).not.toContainText('1');
 await page.getByRole('button',{name:/Prêt|Prête|Terminer/}).last().click();
 await expect(cash).toContainText('1');await cash.click();
 await expect(page.getByRole('button',{name:/A encaisser/})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Encaisse',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Encaisse',exact:true}).click();await expect(cash).not.toContainText('1');
 await expect(page.getByRole('link',{name:'Créer ma page gratuitement',exact:true})).toBeVisible();expect(writes).toBe(0);
});
