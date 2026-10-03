import {describe,expect,it} from 'vitest';
import {demoJourney} from '@/lib/demo-journey';
import {createDemoOrder} from '@/lib/demo-order';
import type {DbOrder} from '@/types/database';
describe('a guided demo uses actual sample order progress',()=>{
 it('starts before reception and ignores real or foreign orders',()=>{
  const order=createDemoOrder('a',1,{customer:'Demo',notes:''});
  expect(demoJourney('a',[]).stage).toBe('start');
  expect(demoJourney('a',[{...order,id:'real-order',is_test:false}, {...order,restaurant_id:'b'}]).stage).toBe('start');
 });
 for(const [status,stage] of [['new','received'],['preparing','preparing'],['ready','ready'],['done','done']] as const)it(`follows ${status} after a reload rather than a timer`,()=>{
  const order=createDemoOrder('a',1,{customer:'Demo',notes:''});
  expect(demoJourney('a',[{...order,status}])).toMatchObject({stage,order:{id:order.id}});
 });
 it('uses the newest sample and ignores cancelled ones',()=>{
  const older={...createDemoOrder('a',1,{customer:'Demo',notes:''}),status:'done' as const,created_at:'2026-10-01T10:00:00Z'};
  const newer={...createDemoOrder('a',2,{customer:'Demo',notes:''}),created_at:'2026-10-02T10:00:00Z'};
  expect(demoJourney('a',[older,newer]).stage).toBe('received');
  // A malformed API/storage status must not masquerade as progress.
  expect(demoJourney('a',[older,{...newer,status:'cancelled' as DbOrder['status']}]).stage).toBe('done');
 });
});
