import {expect, test, type Locator, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

const dictionary = (language:string) => JSON.parse(readFileSync(new URL(`../src/i18n/${language}.json`, import.meta.url), 'utf8')) as Record<string,string>;
const merchantName='La Boutique des Saveurs de Monéteau';

async function contrast(locator:Locator, text=false) {
  return locator.evaluate((element, isText) => {
    const rgb = (value:string) => value.match(/[\d.]+/g)!.map(Number);
    const luminance = (channels:number[]) => channels.slice(0,3).map(x => {
      const s=x/255; return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;
    }).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
    let surface:Element|null=element;
    while(surface && (rgb(getComputedStyle(surface).backgroundColor)[3]??1)<1) surface=surface.parentElement;
    if(!surface) return {opaque:false,ratio:0};
    const foreground = rgb(getComputedStyle(isText?element:element.querySelector('svg')??element).color);
    const background = rgb(getComputedStyle(surface).backgroundColor);
    const a=luminance(foreground), b=luminance(background);
    return {opaque:surface===element || element.contains(surface), ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  }, text);
}

async function publicMenu(page:Page, {cover='bright',language='fr',open=true,primary='#187A26',customer=false}={}) {
  await page.setViewportSize({width:320,height:568});
  const user={id:'10000000-0000-4000-8000-000000000002',email:'alice@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{role:'customer',name:'Alice'}};
  if(customer) {
    const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.test`;
    await page.addInitScript(({user,jwt})=>localStorage.setItem('commandeici_auth',JSON.stringify({access_token:jwt,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,jwt});
  }
  await page.route('**/contrast-cover.svg', route => route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect width="800" height="300" fill="${cover==='bright'?'#fff':'#080808'}"/></svg>`}));
  await page.route(url=>['/rest/v1/','/functions/v1/','/auth/v1/'].some(prefix=>url.pathname.startsWith(prefix)), async route => {
    const path=new URL(route.request().url()).pathname;
    expect(route.request().method()).toMatch(/^(GET|POST)$/);
    const restaurant={id:'contrast-fixture',slug:'contrast-shop',name:merchantName,city:'Paris',categories:['Plats'],image:null,cover_image:'/contrast-cover.svg',is_open:open,is_accepting_orders:open,availability_mode:'manual',account_status:'active',primary_color:primary,payment_methods:['cash'],prep_time_config:{default_minutes:15},out_of_stock_ingredients:[]};
    if(path.endsWith('/customer_profiles')) {
      expect(route.request().method()).toBe('GET');
      await route.fulfill({json:{id:user.id,name:'Alice',email:user.email,phone:null,default_order_type:'collect'}});return;
    }
    if(path.includes('/auth/v1/')) {expect(route.request().method()).toBe('GET');await route.fulfill({json:user});return;}
    await route.fulfill({json:path.endsWith('/rpc/get_public_restaurant_by_slug')?restaurant:path.endsWith('/menu_items')?[{id:'contrast-pizza',restaurant_id:restaurant.id,name:'Pizza',price:12,category:'Plats',enabled:true,product_type:'simple'}]:[]});
  });
  await page.goto(`/contrast-shop?lang=${language}`,{waitUntil:'networkidle'});
  await expect(page.getByRole('button',{name:language==='ar'?/^بيتزا/:/^Pizza/}).first()).toBeVisible();
}

for(const cover of ['bright','dark']) for(const language of ['fr','ar']) {
  test(`signed-in customer initial remains readable on ${cover} cover in ${language}`,async({page},info)=>{
    const t=dictionary(language);await publicMenu(page,{cover,language,customer:true});
    const profile=page.getByRole('button',{name:t['client.title'],exact:true});
    await expect(profile).toHaveText('A');
    const initial=profile.getByText('A',{exact:true});
    expect((await contrast(initial,true)).ratio).toBeGreaterThanOrEqual(4.5);
    await profile.hover();expect((await contrast(initial,true)).ratio).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({path:info.outputPath('signed-in-hero.png')});
    await profile.click();await expect(page.getByRole('menuitem',{name:t['client.title'],exact:true})).toBeVisible();
    await expect(page.getByRole('menuitem',{name:t['client.logout'],exact:true})).toBeVisible();
    await expect.poll(()=>page.getByRole('menu').evaluate(el=>el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');await expect(profile).toBeFocused();
  });
}

for(const cover of ['bright','dark']) for(const language of ['fr','ar']) for(const open of [true,false]) {
  test(`menu controls and ${open?'open':'closed'} status contrast on ${cover} cover in ${language}`,async({page},info)=>{
    const t=dictionary(language);await publicMenu(page,{cover,language,open});
    await page.screenshot({path:info.outputPath('hero.png')});
    expect(await page.getByRole('heading',{name:merchantName,exact:true}).evaluate(el=>el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight),'The complete merchant name must be readable').toBe(true);
    for(const label of [t['nav.back'],t['client.title'],language==='ar'?'العربية':'Français']) {
      const control=page.getByRole('button',{name:label,exact:true});
      await expect(control).toBeVisible();
      const bounds=(await control.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(320);
      expect(await control.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
      const pair=await contrast(control);expect(pair.opaque,`Stable background for ${label}`).toBe(true);expect(pair.ratio,`Icon contrast for ${label}`).toBeGreaterThanOrEqual(3);
      if(label===(language==='ar'?'العربية':'Français'))expect((await contrast(control.locator('span'),true)).ratio).toBeGreaterThanOrEqual(4.5);
      await control.focus();expect(await control.evaluate(el=>el===document.activeElement)).toBe(true);
    }
    expect((await contrast(page.getByText(t[open?'status.open':'status.closed'],{exact:true}),true)).ratio).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('button',{name:t['client.title'],exact:true}).click();
    await expect(page.getByRole('menuitem',{name:t['auth.login'],exact:true})).toBeVisible();
    const accountMenu=page.getByRole('menu');await expect.poll(()=>accountMenu.evaluate(el=>el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');await expect(accountMenu).toBeHidden();
    await page.getByRole('button',{name:language==='ar'?'العربية':'Français',exact:true}).click();
    const spanish=page.getByRole('button',{name:'ES Español',exact:true});await expect(spanish).toBeVisible();
    await expect.poll(()=>spanish.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),{message:'The language option must be above the restaurant card'}).toBe(true);
    await page.screenshot({path:info.outputPath('language-menu.png')});
    if(info.project.name==='desktop-chrome') await spanish.click();
    else {const bounds=(await spanish.boundingBox())!;await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y+bounds.height/2);}
    await expect(page.getByRole('button',{name:'Español',exact:true})).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang','es');await expect(page.locator('html')).toHaveAttribute('dir','ltr');
    await page.getByRole('button',{name:dictionary('es')['nav.back'],exact:true}).click();await expect(page).toHaveURL(/\/decouvrir(?:\?|$)/);
  });
}

for(const primary of ['#ffff00','#00ff00','#00ffff','#ffffff','#ff6600','#187A26']) {
  test(`custom merchant color ${primary} keeps white cart text readable`,async({page})=>{
    await publicMenu(page,{primary});
    await page.getByRole('button',{name:/^Pizza/}).first().click();
    await page.getByRole('button',{name:/^Ajouter -/}).click();
    const cart=page.getByRole('button',{name:/Voir la commande/});await expect(cart).toBeVisible();
    expect((await contrast(cart,true)).ratio).toBeGreaterThanOrEqual(4.5);
  });
}

test('cash count stays readable while taking an order',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('cm_onboarding_done_demo','true'));
  await page.goto('/admin/demo?view=cuisine&lang=fr',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Recevoir une commande',exact:true}).click();
  await page.getByRole('dialog',{name:'Nouvelle commande !'}).getByRole('button',{name:'Fermer',exact:true}).click();
  await page.getByRole('button',{name:'Accepter',exact:true}).last().click();
  await page.getByRole('button',{name:/Prêt|Prête|Terminer/}).last().click();
  await page.locator('[data-tour="caisse"]:visible').click();
  await page.getByRole('button',{name:/Prise de commande/}).click();
  const badge=page.getByRole('button',{name:/A encaisser/}).locator('span').last();
  await expect(badge).toBeVisible();expect((await contrast(badge,true)).ratio).toBeGreaterThanOrEqual(4.5);
});

test('tracking demo CTA stays readable and touchable at320px',async({page})=>{
  const t=dictionary('fr');await page.setViewportSize({width:320,height:568});
  await page.route(url=>url.pathname.startsWith('/rest/v1/'),async route=>{
    const path=new URL(route.request().url()).pathname;
    const order={id:'contrast-order',status:'ready',display_number:'CB-01',created_at:new Date().toISOString(),items:[],total:12,restaurant:{name:'Boutique test',slug:'contrast-shop',primary_color:'#187A26',restaurant_phone:'',is_demo:true}};
    await route.fulfill({json:path.endsWith('/rpc/get_order_for_tracking')?order:[]});
  });
  await page.goto('/suivi/contrast-order?lang=fr',{waitUntil:'networkidle'});
  const cta=page.getByRole('link',{name:t['demo.suivi_cta'],exact:true});await expect(cta).toBeVisible();
  expect((await contrast(cta,true)).ratio).toBeGreaterThanOrEqual(4.5);
  expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await contrast(page.getByText(t['suivi.your_order'],{exact:true}),true)).ratio).toBeGreaterThanOrEqual(4.5);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('shared success and destructive actions keep their small text readable',async({page})=>{
  await page.goto('/decouvrir?lang=fr',{waitUntil:'networkidle'});
  for(const token of ['success','destructive']) {
    await page.evaluate(token=>{
      const control=document.createElement('button');control.id='contrast-token';control.textContent='Action';
      control.style.cssText=`font-size:14px;background:hsl(var(--${token}));color:hsl(var(--${token}-foreground))`;
      document.body.append(control);
    },token);
    expect((await contrast(page.locator('#contrast-token'),true)).ratio,token).toBeGreaterThanOrEqual(4.5);
    await page.locator('#contrast-token').evaluate(el=>el.remove());
  }
});
