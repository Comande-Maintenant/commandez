import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import * as demo from '@/lib/demo-commerce';
beforeEach(()=>sessionStorage.clear());
afterEach(()=>vi.restoreAllMocks());
it('rejects inherited object names as demo sectors',()=>{
 expect(()=>demo.demoCatalog('toString' as demo.DemoSector)).toThrow();
});
it('rejects unsupported quantity changes',()=>{
 const state=demo.addCommerceDemoLine('epicerie',demo.initialCommerceDemoState('epicerie'),demo.configureCommerceLine('epicerie','coca'));
 expect(()=>demo.changeCommerceDemoQuantity('epicerie',state,state.cart[0].key,0 as 1)).toThrow();
});
it('offers full illustrated grocery and florist catalogues with sector-specific choices',()=>{
 expect(demo.demoCatalog('epicerie').products.length).toBeGreaterThanOrEqual(10);
 expect(demo.demoCatalog('fleuriste').products.length).toBeGreaterThanOrEqual(8);
});
it('keeps two differently configured bouquets separate and computes exact totals',()=>{
 let state=demo.initialCommerceDemoState('fleuriste');
 const first=demo.configureCommerceLine('fleuriste','bouquet',{size:'generous',palette:'pastel',finish:'wrapped'},'Bon anniversaire',1,state.products);
 const second=demo.configureCommerceLine('fleuriste','bouquet',{},'',2,state.products);
 state=demo.addCommerceDemoLine('fleuriste',state,first);state=demo.addCommerceDemoLine('fleuriste',state,second);
 expect(state.cart).toHaveLength(2);expect(first.unitPriceCents).toBe(4050);expect(demo.commerceDemoTotal('fleuriste',state.cart)).toBe(92.5);
});
it('rejects unknown products, options, excessive notes and invalid quantities',()=>{
 for(const choices of [{size:'free'},{unknown:'option'}])expect(()=>demo.configureCommerceLine('fleuriste','bouquet',choices)).toThrow();
 expect(()=>demo.configureCommerceLine('epicerie','bouquet')).toThrow();
 expect(()=>demo.configureCommerceLine('fleuriste','bouquet',{},'x'.repeat(161))).toThrow();
 for(const qty of [-1,0,NaN,Infinity,1.5,100])expect(()=>demo.configureCommerceLine('epicerie','coca',{},'',qty)).toThrow();
});
it('reserves stock once on simulation, snapshots prices and preserves payment until collection',()=>{
 let state=demo.initialCommerceDemoState('epicerie');const before=state.products.coca.stock;
 state=demo.addCommerceDemoLine('epicerie',state,demo.configureCommerceLine('epicerie','coca',{},'',2,state.products));
 state=demo.submitCommerceDemoOrder('epicerie',state,'30');expect(state.cart).toEqual([]);expect(state.products.coca.stock).toBe(before-2);expect(state.orders[0].pickup).toBe('30');expect(state.orders[0].total).toBe(3.6);
 expect(()=>demo.submitCommerceDemoOrder('epicerie',state,'30')).toThrow();expect(()=>demo.collectCommerceDemoOrder(state,state.orders[0].id,'cash')).toThrow();
 state=demo.updateCommerceDemoProduct('epicerie',state,'coca',{priceCents:350});expect(state.orders[0].total).toBe(3.6);
 state={...state,orders:state.orders.map(order=>demo.advanceCommerceDemoOrder(demo.advanceCommerceDemoOrder(order)))};
 state=demo.collectCommerceDemoOrder(state,state.orders[0].id,'card');expect(state.orders[0].status).toBe('done');expect(state.orders[0].paidVia).toBe('card');expect(state.products.coca.stock).toBe(before-2);
 expect(()=>demo.collectCommerceDemoOrder(state,state.orders[0].id,'card')).toThrow();
});
it('caps aggregate product quantities across variants and blocks an unavailable basket',()=>{
 let state=demo.initialCommerceDemoState('fleuriste');state=demo.updateCommerceDemoProduct('fleuriste',state,'bouquet',{stock:1});
 state=demo.addCommerceDemoLine('fleuriste',state,demo.configureCommerceLine('fleuriste','bouquet',{},'',1,state.products));
 expect(()=>demo.addCommerceDemoLine('fleuriste',state,demo.configureCommerceLine('fleuriste','bouquet',{size:'large'},'',1,state.products))).toThrow();
 state=demo.updateCommerceDemoProduct('fleuriste',state,'bouquet',{enabled:false});expect(()=>demo.submitCommerceDemoOrder('fleuriste',state,'soon')).toThrow();
 state=demo.changeCommerceDemoQuantity('fleuriste',state,state.cart[0].key,-1);expect(state.cart).toEqual([]);
});
it('reprices a pending basket after a catalogue edit without changing an old order',()=>{
 let state=demo.initialCommerceDemoState('epicerie');state=demo.addCommerceDemoLine('epicerie',state,demo.configureCommerceLine('epicerie','coca'));
 state=demo.updateCommerceDemoProduct('epicerie',state,'coca',{priceCents:210});expect(demo.commerceDemoTotal('epicerie',state.cart)).toBe(2.1);
 for(const patch of [{priceCents:-1},{priceCents:1.5},{stock:-1},{stock:Infinity}])expect(()=>demo.updateCommerceDemoProduct('epicerie',state,'coca',patch)).toThrow();
});
it('persists configured snapshots, bounds state and refuses forged totals and cross-sector lines',()=>{
 let state=demo.initialCommerceDemoState('fleuriste');state=demo.addCommerceDemoLine('fleuriste',state,demo.configureCommerceLine('fleuriste','bouquet',{size:'large'},'Merci'));
 state=demo.submitCommerceDemoOrder('fleuriste',state,'60');demo.saveCommerceDemo('fleuriste',state);expect(demo.loadCommerceDemo('fleuriste')).toEqual(state);expect(demo.loadCommerceDemo('epicerie').orders).toEqual([]);
 const forged=structuredClone(state);forged.orders[0].total=0;sessionStorage.setItem('commandeici:commerce-demo:fleuriste',JSON.stringify(forged));expect(demo.loadCommerceDemo('fleuriste').orders).toEqual([]);
 sessionStorage.setItem('commandeici:commerce-demo:epicerie',JSON.stringify(state));expect(demo.loadCommerceDemo('epicerie').cart).toEqual([]);expect(demo.loadCommerceDemo('epicerie').orders).toEqual([]);
});
it('migrates a build6 cart and order without touching the global restaurant cart',()=>{
 localStorage.setItem('resto-order-cart','keep-this');const old={id:'demo-local-11111111-1111-4111-8111-111111111111',sector:'fleuriste',number:1,createdAt:Date.now(),status:'new',items:{bouquet:1},total:26};
 sessionStorage.setItem('commandeici:commerce-demo:fleuriste',JSON.stringify({cart:{bouquet:2},orders:[old]}));const state=demo.loadCommerceDemo('fleuriste');
 expect(state.version).toBe(2);expect(state.cart[0].productId).toBe('bouquet');expect(state.cart[0].quantity).toBe(2);expect(state.orders[0].total).toBe(26);expect(localStorage.getItem('resto-order-cart')).toBe('keep-this');
});
it('does not accept duplicate orders from storage',()=>{
 let state=demo.initialCommerceDemoState('epicerie');state=demo.receiveCommerceDemoSample('epicerie',state);
 sessionStorage.setItem('commandeici:commerce-demo:epicerie',JSON.stringify({...state,orders:[state.orders[0],state.orders[0]]}));expect(demo.loadCommerceDemo('epicerie').orders).toHaveLength(1);
});
it('refuses malformed status and payment types from local storage',()=>{
 const state=demo.receiveCommerceDemoSample('epicerie',demo.initialCommerceDemoState('epicerie'));
 for(const patch of [{status:['new']},{status:'done',paidVia:['card']}]){
  sessionStorage.setItem('commandeici:commerce-demo:epicerie',JSON.stringify({...state,orders:[{...state.orders[0],...patch}]}));
  expect(demo.loadCommerceDemo('epicerie').orders).toEqual([]);
 }
});
it('remains usable with blocked storage',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('Blocked');});
 expect(demo.loadCommerceDemo('epicerie')).toEqual(demo.initialCommerceDemoState('epicerie'));
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Blocked');});
 expect(()=>demo.saveCommerceDemo('epicerie',demo.initialCommerceDemoState('epicerie'))).not.toThrow();
});
