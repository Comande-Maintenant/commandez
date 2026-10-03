import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {describe,expect,it,vi} from 'vitest';
import {escapeHtml} from '../../supabase/functions/_shared/html';
import {restaurantDocument} from '../../supabase/functions/_shared/restaurant-document';

function fixture(){
 let handler!:(req:Request)=>Promise<Response>;
 const frontend=readFileSync('src/pages/RestaurantPage.tsx','utf8');
 const demoSlug=frontend.match(/const DEMO_SLUG = "([^"]+)";/)?.[1];
 if(!demoSlug)throw new Error('Frontend demo identity unavailable');
 const rpc=vi.fn(async (_name:string,{p_slug}:{p_slug:string})=>({data:{id:'local-only',slug:p_slug,name:p_slug==='demo'?'Old Paris demo':'Antalya Kebab',city:p_slug==='demo'?'Paris':'Monéteau',is_demo:p_slug===demoSlug||p_slug==='demo',account_status:'active'},error:null}));
 const query={select:()=>query,eq:()=>query,order:()=>query,limit:async()=>({data:[],error:null})};
 const source=readFileSync('supabase/functions/og-restaurant/index.ts','utf8').replace(/^import .*;\n/gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 new Function('Deno','createClient','escapeHtml','restaurantDocument',js)({serve:(fn:typeof handler)=>{handler=fn;},env:{get:()=>''}},()=>({rpc,from:()=>query}),escapeHtml,restaurantDocument);
 const request=(slug:string)=>handler(new Request(`https://fixture.supabase.co/og-restaurant?format=json&slug=${slug}`));
 return {request,rpc,demoSlug};
}
describe('public demo HTML resolves the same merchant as the application',()=>{
 it('renders /demo with the actual frontend demo merchant and city',async()=>{
  const f=fixture();const response=await f.request('demo');const doc=await response.json();
  expect(f.rpc).toHaveBeenCalledWith('get_public_restaurant_by_slug',{p_slug:f.demoSlug});
  expect(doc.body).toContain('Antalya Kebab');expect(doc.body).toContain('Monéteau');expect(doc.body).not.toContain('Old Paris demo');
  expect(doc.head).toContain(`https://app.commandeici.com/${f.demoSlug}`);expect(doc.head).toContain('noindex');
 });
 it('keeps an ordinary merchant lookup unchanged',async()=>{
  const f=fixture();const response=await f.request('chez-alice-moneteau');
  expect(response.status).toBe(200);expect(f.rpc).toHaveBeenCalledWith('get_public_restaurant_by_slug',{p_slug:'chez-alice-moneteau'});
  expect((await response.json()).head).toContain('https://app.commandeici.com/chez-alice-moneteau');
 });
});
