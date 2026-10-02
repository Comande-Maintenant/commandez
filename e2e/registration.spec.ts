import { test, expect } from '@playwright/test';
const id='10000000-0000-4000-8000-000000000001';
test('email confirmation waits without owner writes and survives a reload',async({page})=>{
  let writes=0;
  await page.route(url => url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/functions/v1/'),async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.includes('/owners')) { if(route.request().method()==='POST')writes++; await route.fulfill({json:[]});return; }
    if(path.includes('/auth/v1/signup')) { await route.fulfill({json:{id,email:'owner@example.test',user_metadata:{role:'owner'},identities:[]}});return; }
    await route.fulfill({json:{}});
  });
  await page.goto('/inscription?lang=fr');
  await page.locator('#email').fill('owner@example.test'); await page.locator('#password').fill('Password123!');
  await page.locator('#password').press('Enter');
  await expect(page.getByRole('heading',{name:'Confirmez votre adresse e-mail'})).toBeVisible();
  await expect(page.getByText('Etape 1 sur 6')).toBeVisible();
  expect(writes).toBe(0);
  await page.reload(); await expect(page.getByRole('heading',{name:'Confirmez votre adresse e-mail'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('Password123!');
});
test('post-order customer signup waits for email confirmation without creating a profile', async ({ page }) => {
  let profileWrites = 0;
  await page.route(url => url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/rpc/get_order_for_tracking')) {
      await route.fulfill({ json: { id, order_number: 1, status: 'done', created_at: new Date().toISOString(), items: [], total: 10, customer_email: 'customer@example.test', customer_name: 'Client', customer_phone: '', restaurant: { name: 'Chez Alice', slug: 'chez-alice', primary_color: '#22c55e', restaurant_phone: '', is_demo: false } } }); return;
    }
    if (path.endsWith('/auth/v1/signup')) { await route.fulfill({ json: { id, email: 'customer@example.test', user_metadata: { role: 'customer' }, identities: [] } }); return; }
    if (path.includes('/customer_profiles') && route.request().method() === 'POST') profileWrites++;
    await route.fulfill({ json: {} });
  });
  await page.goto(`/suivi/${id}?lang=fr`);
  await page.locator('input[type=password]').fill('Password123!');
  await page.getByRole('button', { name: /Cr[eé]er mon profil/i }).click();
  await expect(page.getByRole('heading', { name: 'Confirmez votre adresse e-mail' })).toBeVisible();
  expect(profileWrites).toBe(0);
  await expect(page.locator('input[type=password]')).toHaveCount(0);
});
test('verified owner resumes the full restaurant journey without overwriting the owner',async({page})=>{
  const user={id,email:'owner@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{role:'owner',phone:'0600000000'}};
  const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.test`;
  let publishes=0; let ownerWrites=0;
  await page.addInitScript(({user,jwt})=>{
    localStorage.setItem('cm_language','fr');
    localStorage.setItem('commandeici_auth',JSON.stringify({access_token:jwt,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
    document.cookie = 'commandeici_auth=' + encodeURIComponent(JSON.stringify({access_token:jwt,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})) + '; path=/; secure; samesite=lax';
  },{user,jwt});
  await page.route(url => url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/functions/v1/'),async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/auth/v1/user')) {await route.fulfill({json:user});return;}
    if(path.includes('/owners')) {if(route.request().method()==='POST')ownerWrites++; await route.fulfill({json:{id}});return;}
    if(path.includes('/restaurants')) {await route.fulfill({json:[]});return;}
    if(path.endsWith('/rpc/complete_onboarding')) {publishes++; await route.fulfill({json:{id:'restaurant-test',slug:'chez-alice-paris',name:'Chez Alice',created:true}});return;}
    await route.fulfill({json:{}});
  });
  await page.goto('/inscription');
  await expect(page.getByText('Etape 2 sur 6')).toBeVisible();
  await page.getByRole('button',{name:/manuel/i}).click();
  await page.locator('#name').fill('Chez Alice');await page.locator('#address').fill('1 rue Exemple');await page.locator('#city').fill('Paris');await page.locator('#cuisine').fill('Pizza');
  await page.getByRole('button',{name:'Continuer',exact:true}).click();
  await expect(page.getByText('Etape 3 sur 6')).toBeVisible();
  await page.getByRole('button',{name:/carte manuellement/i}).click();
  await expect(page.getByText('Etape 4 sur 6')).toBeVisible();
  await page.locator('textarea').fill('Pizzas maison');
  await page.reload(); await expect(page.getByText('Etape 4 sur 6')).toBeVisible(); await expect(page.locator('textarea')).toHaveValue('Pizzas maison');
  await page.getByRole('button',{name:'Continuer',exact:true}).click();
  await expect(page.getByText('Etape 5 sur 6')).toBeVisible();
  await page.getByRole('button',{name:/essai gratuit/i}).click();
  await expect(page.getByText('https://app.commandeici.com/chez-alice-paris',{exact:true})).toBeVisible();
  expect(publishes).toBe(1);expect(ownerWrites).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
