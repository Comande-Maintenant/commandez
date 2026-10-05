import {expect,test} from '@playwright/test';
test('a dashboard opened directly has a working return without browser history',async({page})=>{
 await page.goto('/admin/demo?lang=fr',{waitUntil:'networkidle'});
 await page.locator('[data-dashboard-header] header button').first().click();
 await expect(page).toHaveURL(/\/decouvrir(?:\?|$)/);
});
test('view and language URL updates preserve the in-app navigation history',async({page})=>{
 await page.goto('/?lang=fr',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Je suis commerçant',exact:true}).click();await page.getByRole('button',{name:'Tester sans créer de compte',exact:true}).click();
 await page.getByRole('link',{name:/Restauration/}).click();await expect(page.getByRole('button',{name:'Recevoir une commande',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.history.state?.idx)).toBe(3);
 await page.locator('[data-dashboard-header] header button').first().click();await expect(page).toHaveURL(/\/decouvrir(?:\?|$)/);
});
