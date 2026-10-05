import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('photo upload failure keeps confirmed photos and makes a new selection possible',async({page})=>{
 let posts=0;
 await page.route('**/functions/v1/photo-upload*',async route=>{
  if(route.request().method()!=='POST')return route.fulfill({json:{restaurantName:'Commerce test',photos:[]}});
  posts++;
  if(posts===2)return route.abort('failed');
  return route.fulfill({json:{url:'/images/brand/commandeici-mark.png'}});
 });
 await page.setViewportSize({width:320,height:568});await page.goto('/upload/fixture?token=local&lang=fr');
 const gallery=page.getByRole('button',{name:'Depuis la galerie'});await expect(gallery).toBeEnabled();
 const input=page.locator('input[type=file]');const buffer=readFileSync('public/images/brand/commandeici-mark.png');
 await input.setInputFiles([{name:'first.png',mimeType:'image/png',buffer},{name:'second.png',mimeType:'image/png',buffer},{name:'third.png',mimeType:'image/png',buffer}]);
 await expect(page.getByRole('alert')).toBeVisible();await expect(gallery).toBeEnabled();await expect(page.getByAltText('Photo 1',{exact:true})).toBeVisible();expect(posts).toBe(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await input.inputValue()).toBe('');
 await input.setInputFiles({name:'chosen-again.png',mimeType:'image/png',buffer});await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByAltText('Photo 2',{exact:true})).toBeVisible();expect(posts).toBe(3);
 await expect(page.getByRole('button',{name:'Retour',exact:true})).toBeVisible();
});
