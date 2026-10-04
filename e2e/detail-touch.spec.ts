import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
const dictionary=(language:string)=>JSON.parse(readFileSync(`src/i18n/${language}.json`,'utf8')) as Record<string,string>;
test.beforeEach(async({page})=>{await page.addInitScript(()=>{localStorage.setItem('cm_onboarding_done_demo','true');localStorage.setItem('cm_onboarding_done_antalya-kebab-moneteau','true');});});
for(const language of ['fr','ar','de','ru'])test(`order editing controls stay reachable and labelled at320px in ${language}`,async({page})=>{
 const t=dictionary(language);await page.setViewportSize({width:320,height:568});let writes=0;
 await page.route(url=>/\/rpc\/(advance_demo_order|update_order_status|update_order_items)$/.test(url.pathname),async route=>{writes++;await route.fulfill({status:400,json:{message:'Sample remains local'}});});
 await page.goto(`/admin/demo?view=cuisine&lang=${language}`);
 await page.getByRole('button',{name:t['demo.try.receive'],exact:true}).click();
 const arrival=page.getByRole('dialog');await expect(arrival).toBeVisible();await arrival.getByRole('button',{name:t['cart.view'],exact:true}).click();
 const detail=page.getByRole('dialog',{name:/^(CB-|#)/});await expect(detail).toBeVisible();
 for(const viewport of [{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(viewport);
  const accept=detail.getByRole('button',{name:t['dashboard.orders.accept_order'],exact:true});await expect(accept).toBeVisible();
  const checks=await accept.evaluate(button=>{const b=button.getBoundingClientRect();const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);let node;const rects=[];while((node=walker.nextNode())){if(!node.textContent?.trim())continue;const range=document.createRange();range.selectNodeContents(node);rects.push(...Array.from(range.getClientRects()));}return rects.every(r=>r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1);});
  expect(checks,'The full primary action must fit inside its button').toBe(true);
  const layout=await accept.evaluate(button=>{const footer=button.parentElement!.parentElement!,scroll=footer.previousElementSibling!;const f=footer.getBoundingClientRect(),s=scroll.getBoundingClientRect();scroll.scrollTop=scroll.scrollHeight;return {noOverlap:s.bottom<=f.top+1,insideViewport:f.bottom<=innerHeight+1,scrollable:scroll.clientHeight>0};});expect(layout).toEqual({noOverlap:true,insideViewport:true,scrollable:true});
 }
 await page.setViewportSize({width:320,height:568});
 const edit=detail.getByRole('button',{name:t['common.edit'],exact:true});expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(44);await edit.click();
 for(const name of [t['cart.decrease'],t['cart.increase'],t['cart.remove'],t['common.cancel']]){
  const action=detail.getByRole('button',{name:new RegExp('^'+name)}).first();await expect(action).toBeVisible();const bounds=(await action.boundingBox())!;expect(bounds.height).toBeGreaterThanOrEqual(44);expect(bounds.width).toBeGreaterThanOrEqual(44);
 }
 const plus=detail.getByRole('button',{name:new RegExp('^'+t['cart.increase'])}).first();await plus.click();expect(await plus.evaluate(el=>el.parentElement!.textContent)).toContain('2');
 await detail.getByRole('button',{name:new RegExp('^'+t['cart.decrease'])}).first().click();expect(await plus.evaluate(el=>el.parentElement!.textContent)).toContain('1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await detail.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(writes).toBe(0);
 await expect(detail.getByText(t['cart.total'],{exact:true})).toBeVisible();
 await detail.getByRole('button',{name:t['common.cancel'],exact:true}).click();await detail.getByRole('button',{name:t['common.close'],exact:true}).click();await expect(detail).toBeHidden();
});
test('customer menu is translated and touchable and the availability thumb stays inside its RTL track',async({page})=>{
 const t=dictionary('ar');await page.setViewportSize({width:320,height:568});await page.goto('/demo?lang=ar');
 const avatar=page.getByRole('button',{name:t['client.title'],exact:true});await expect(avatar).toBeVisible();const bounds=(await avatar.boundingBox())!;expect(bounds.height).toBeGreaterThanOrEqual(44);expect(bounds.width).toBeGreaterThanOrEqual(44);await avatar.click();
 const login=page.getByRole('menuitem',{name:t['auth.login'],exact:true});await expect(login).toBeVisible();await expect.poll(()=>page.getByRole('menu').evaluate(el=>el.getAnimations().every(animation=>animation.playState!=='running'))).toBe(true);expect((await login.boundingBox())!.height).toBeGreaterThanOrEqual(44);await login.click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await page.goto('/admin/demo?lang=ar');const available=page.getByRole('switch').first();await expect(available).toBeVisible();
 await expect.poll(()=>available.evaluate(el=>{const track=el.getBoundingClientRect(),thumb=el.querySelector('span')!.getBoundingClientRect();return thumb.left>=track.left&&thumb.right<=track.right;})).toBe(true);
});
test('garnish shortcuts provide full touch targets without crowding the sheet',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto('/demo?lang=fr');await page.getByRole('button',{name:/^Tacos/}).first().click();await page.getByRole('button',{name:/^Tacos Normal/}).click();await page.getByRole('button',{name:'Kebab',exact:true}).click();const next=page.getByTestId('customizer-next');await next.click();
 const full=page.getByRole('button',{name:'Complet',exact:true});for(let i=0;i<8&&!await full.isVisible();i++){await expect(next).toBeEnabled();await next.click();}
 for(const name of ['Complet','Nature']){const action=page.getByRole('button',{name,exact:true});await expect(action).toBeVisible();const bounds=(await action.boundingBox())!;expect(bounds.height).toBeGreaterThanOrEqual(44);expect(bounds.width).toBeGreaterThanOrEqual(44);}
 const dialog=page.getByRole('dialog');expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.getByRole('button',{name:'Nature',exact:true}).click();await expect(next).toBeEnabled();
});
