import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
const read=(lang:string)=>JSON.parse(readFileSync(new URL('../src/i18n/'+lang+'.json',import.meta.url),'utf8')) as Record<string,string>;
const fr=read('fr'),de=read('de'),ar=read('ar');
const dictionaries={fr,de,ar};
for(const language of ['fr','de','ar'] as const)test(`signup progress stays readable at320px in ${language}`,async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto(`/inscription?lang=${language}`,{waitUntil:'networkidle'});
 const dictionary=dictionaries[language] as Record<string,string>;await expect(page.getByRole('heading',{name:dictionary['auth.signup.create_account'],exact:true})).toBeVisible();const boxes=[];
 for(const key of ['account','restaurant','menu','design','plan','done']){
  const label=dictionary['auth.signup.step_'+key];
  const nodes=page.getByText(label,{exact:true});
  for(const node of await nodes.all())if(await node.isVisible()){
   expect(await node.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight)).toBe(true);
   const box=(await node.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);boxes.push(box);
  }
 }
 expect(boxes.length).toBeGreaterThan(0);
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j];if(a.y<b.y+b.height&&b.y<a.y+a.height){
   const gap=a.x<b.x?b.x-a.x-a.width:a.x-b.x-b.width;expect(gap,'Progress labels must have separation').toBeGreaterThanOrEqual(6);
  }
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('demo banner and new-order badge stay legible and touchable',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto('/admin/demo?lang=fr',{waitUntil:'networkidle'});
 const copy=page.getByText(fr['demo.banner_text'],{exact:true});
 await expect(copy).toBeVisible();
 expect(await copy.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight),'Full demo qualification must fit').toBe(true);
 const create=page.getByRole('button',{name:fr['demo.banner_cta'],exact:true});expect((await create.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 const contained=await create.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const text=range.getBoundingClientRect(),button=el.getBoundingClientRect();return text.top>=button.top+2&&text.bottom<=button.bottom-2;});expect(contained,'Every CTA line must fit inside its button').toBe(true);
 await page.getByRole('button',{name:'Recevoir une commande',exact:true}).click();
 const alert=page.getByRole('dialog',{name:'Nouvelle commande !'});await expect(alert).toBeVisible();await alert.getByRole('button',{name:'Fermer',exact:true}).click();await expect(alert).toBeHidden();
 const badge=page.locator('[data-tour="cuisine"]:visible span').filter({hasText:/^[1-9]\d*$/}).last();await expect(badge).toBeVisible();
 const contrast=await badge.evaluate(el=>{
  const style=getComputedStyle(el);const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number);
  const luminance=(channels:number[])=>channels.map(x=>{const s=x/255;return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4);}).reduce((a,x,i)=>a+x*[0.2126,0.7152,0.0722][i],0);
  const a=luminance(rgb(style.color)),b=luminance(rgb(style.backgroundColor));return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
 });expect(contrast,'Badge numbers must remain readable').toBeGreaterThanOrEqual(4.5);
});

test('signup fields and submit support44px touch targets',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto('/inscription?lang=fr',{waitUntil:'networkidle'});
 for(const field of await page.locator('form input:visible').all())expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 expect((await page.getByRole('button',{name:fr['auth.signup.create_button'],exact:true}).boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
for(const language of ['fr','ar'])test(`all languages are reachable in ${language} on a short screen`,async({page})=>{
 await page.setViewportSize({width:320,height:390});await page.goto(`/admin/demo?lang=${language}`,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:language==='ar'?'العربية':'Francais',exact:true}).click();
 const last=page.getByRole('button',{name:'VI Tiếng Việt',exact:true});await last.scrollIntoViewIfNeeded();
 const box=(await last.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);expect(box.y+box.height).toBeLessThanOrEqual(390);expect(box.height).toBeGreaterThanOrEqual(44);
 await last.click();await expect(page.getByRole('button',{name:'Tiếng Việt',exact:true})).toBeVisible();
});
test('product options have an opaque reading surface',async({page})=>{
 await page.goto('/demo?lang=fr',{waitUntil:'networkidle'});await page.getByRole('button',{name:/^Kebab/}).first().click();
 const dialog=page.getByRole('dialog',{name:'Kebab',exact:true});await expect(dialog).toBeVisible();
 const alpha=await dialog.evaluate(el=>{const channels=getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number);return channels.length===4?channels[3]:1;});expect(alpha).toBe(1);
});

for(const language of ['de','ru'])test(`merchant page preview and palette fit320px in ${language}`,async({page})=>{
 const dictionary=read(language);await page.setViewportSize({width:320,height:568});await page.goto(`/admin/demo?view=page&lang=${language}`,{waitUntil:'networkidle'});
 const preview=page.getByRole('link',{name:dictionary['dashboard.page.view_page'],exact:true});await expect(preview).toBeVisible();await preview.scrollIntoViewIfNeeded();
 const box=(await preview.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const swatch of await page.locator('button[style*="background-color"]').all())if(await swatch.isVisible()){const bounds=(await swatch.boundingBox())!;expect(bounds.height).toBeGreaterThanOrEqual(44);expect(bounds.width).toBeGreaterThanOrEqual(44);}
});
