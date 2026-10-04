import {beforeEach,expect,it} from 'vitest';
import {demoCatalog,loadCommerceDemo,saveCommerceDemo,createCommerceDemoOrder,advanceCommerceDemoOrder} from '@/lib/demo-commerce';
beforeEach(()=>sessionStorage.clear());
it('uses separate grocery and florist catalogues and rejects an unknown commerce',()=>{
 expect(demoCatalog('epicerie').products.some(product=>product.id==='basket')).toBe(true);
 expect(demoCatalog('fleuriste').products.some(product=>product.id==='bouquet')).toBe(true);
 expect(()=>demoCatalog('another' as 'epicerie')).toThrow();
});
it('derives prices from trusted products and advances only one actual step',()=>{
 const order=createCommerceDemoOrder('fleuriste',{bouquet:2},1);
 expect(order.total).toBe(52);expect(order.status).toBe('new');
 expect(advanceCommerceDemoOrder(order).status).toBe('preparing');
 const done=advanceCommerceDemoOrder(advanceCommerceDemoOrder(advanceCommerceDemoOrder(order)));
 expect(done.status).toBe('done');expect(advanceCommerceDemoOrder(done)).toEqual(done);
 expect(()=>createCommerceDemoOrder('epicerie',{bouquet:1},2)).toThrow();
});
it('persists each local demo separately and refuses malformed or foreign state',()=>{
 const order=createCommerceDemoOrder('fleuriste',{bouquet:1},1);
 saveCommerceDemo('fleuriste',{cart:{bouquet:1},orders:[order]});
 expect(loadCommerceDemo('fleuriste').orders).toEqual([order]);expect(loadCommerceDemo('epicerie')).toEqual({cart:{},orders:[]});
 sessionStorage.setItem('commandeici:commerce-demo:epicerie',JSON.stringify({cart:{basket:-10},orders:[order]}));
 expect(loadCommerceDemo('epicerie')).toEqual({cart:{},orders:[]});
});
