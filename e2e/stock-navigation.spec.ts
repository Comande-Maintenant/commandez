import {expect,test} from '@playwright/test';
test('stock management keeps return and close visible above its scrolling content',async({page})=>{
 await page.goto('/admin/demo?lang=fr',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/Rupture|Stock/}).first().click();
 const sheet=page.getByRole('dialog');const back=sheet.getByRole('button',{name:'Retour',exact:true});await expect(back).toBeVisible();
 const body=sheet.locator('[data-stock-scroll]');await body.evaluate(element=>{element.scrollTop=element.scrollHeight;});
 await expect(back).toBeVisible();const close=sheet.getByRole('button',{name:'Fermer',exact:true});
 await expect(back).toBeInViewport({ratio:1});await expect(close).toBeInViewport({ratio:1});
 // Measure the actual stable hitbox, not an intermediate drawer animation.
 // DOMRect arithmetic may undershoot 44 by 0.00003 CSS px; retain the 44px
 // layout minimum and compare rendered sizes at 0.001 CSS px precision.
 await expect(async()=>{
  const box=(await close.boundingBox())!;
  const css=await close.evaluate(element=>({width:parseFloat(getComputedStyle(element).width),height:parseFloat(getComputedStyle(element).height)}));
  expect(css.width).toBeGreaterThanOrEqual(44);expect(css.height).toBeGreaterThanOrEqual(44);
  expect(Number(box.width.toFixed(3))).toBeGreaterThanOrEqual(44);expect(Number(box.height.toFixed(3))).toBeGreaterThanOrEqual(44);
 }).toPass({timeout:5000});
 await back.click();await expect(sheet).not.toBeVisible();
});
