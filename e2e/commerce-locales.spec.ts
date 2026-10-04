import {expect,test} from '@playwright/test';
for(const language of ['fr','en','es','de','it','pt','nl','ar','zh','ja','ko','ru','tr','vi'])test(`commerce catalogue and product panels fit 320px in ${language}`,async({page},testInfo)=>{
 await page.setViewportSize({width:320,height:568});
 for(const sector of ['epicerie','fleuriste']){
  await page.goto(`/demo/${sector}?lang=${language}`,{waitUntil:'networkidle'});
  await expect(page.locator('article')).toHaveCount(sector==='epicerie'?10:8);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const button of await page.getByRole('button').all())expect(await button.evaluate(element=>element.scrollWidth<=element.clientWidth),await button.getAttribute('aria-label')??await button.innerText()).toBe(true);
  const firstImage=(await page.locator('article img').first().boundingBox())!;expect(firstImage.y).toBeLessThan(568);
  if(testInfo.project.name==='ios-webkit'&&['fr','ar','de'].includes(language))await page.screenshot({path:testInfo.outputPath(sector+'-catalogue.png'),fullPage:true});
  for(const image of await page.locator('article img').all()){await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate(element=>(element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);}
  await page.locator('article button').first().click();const sheet=page.getByRole('dialog');await expect(sheet).toBeVisible();
  await expect.poll(()=>sheet.evaluate(element=>element.getAnimations().every(animation=>animation.playState!=='running'))).toBe(true);
  expect(await sheet.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  for(const button of await sheet.getByRole('button').all()){const box=(await button.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
  if(testInfo.project.name==='ios-webkit'&&['fr','ar','de'].includes(language))await page.screenshot({path:testInfo.outputPath(sector+'-product.png')});
  await sheet.getByRole('button').first().click();await expect(sheet).not.toBeVisible();
 }
});
