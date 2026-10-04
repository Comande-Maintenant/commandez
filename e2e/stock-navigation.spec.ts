import {expect,test} from '@playwright/test';
test('stock management keeps return and close visible above its scrolling content',async({page})=>{
 await page.goto('/admin/demo?lang=fr',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/Rupture|Stock/}).first().click();
 const sheet=page.getByRole('dialog');const back=sheet.getByRole('button',{name:'Retour',exact:true});await expect(back).toBeVisible();
 const body=sheet.locator('[data-stock-scroll]');await body.evaluate(element=>{element.scrollTop=element.scrollHeight;});
 await expect(back).toBeVisible();const close=sheet.getByRole('button',{name:'Fermer',exact:true});const box=await close.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);
 await back.click();await expect(sheet).not.toBeVisible();
});
