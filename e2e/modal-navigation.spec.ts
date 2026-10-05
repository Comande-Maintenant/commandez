import {expect,test} from '@playwright/test';
for(const viewport of [{width:320,height:568},{width:844,height:390}])test(`long modal exits remain visible at ${viewport.width}x${viewport.height}`,async({page})=>{
 await page.setViewportSize(viewport);let writes=0;await page.route('**/rest/v1/**',async route=>{writes++;await route.fulfill({status:400,json:{message:'Fixture must remain local'}});});
 await page.goto('/e2e/fixtures/modal-navigation.html?lang=fr',{waitUntil:'networkidle'});
 for(const name of ['Ouvrir compléments','Ouvrir import','Ouvrir notification']){
  const trigger=page.getByRole('button',{name,exact:true});await trigger.click();const dialog=page.getByRole('dialog');const close=dialog.getByRole('button',{name:'Fermer',exact:true});
  await expect(close).toBeVisible();
  // Measure after the entry zoom; a centered dialog stays centered throughout it.
  await expect.poll(()=>dialog.evaluate(element=>element.getAnimations().every(animation=>animation.playState!=='running'))).toBe(true);
  const body=dialog.locator('div.overflow-y-auto').first();await body.evaluate(element=>{element.scrollTop=element.scrollHeight;});
  const box=(await close.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
  await close.click();await expect(dialog).not.toBeVisible();
 }
 expect(writes).toBe(0);
});
