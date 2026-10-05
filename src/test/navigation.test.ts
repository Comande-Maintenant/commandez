import {afterEach,expect,it,vi} from 'vitest';
import type {NavigateFunction} from 'react-router-dom';
import {navigateBack} from '@/lib/navigation';
afterEach(()=>window.history.replaceState(null,''));
it('returns within the router stack when an earlier app entry exists',()=>{
 window.history.replaceState({idx:2,key:'app-entry'},'');const navigate=vi.fn() as unknown as NavigateFunction;
 navigateBack(navigate,'/decouvrir');expect(navigate).toHaveBeenCalledWith(-1);
});
it('replaces a direct or malformed entry with a known local exit',()=>{
 for(const state of [null,{}, {idx:0},{idx:-1},{idx:'2'},{idx:Infinity},{idx:1.5}]){
  window.history.replaceState(state,'');const navigate=vi.fn() as unknown as NavigateFunction;
  navigateBack(navigate,'/decouvrir');expect(navigate).toHaveBeenCalledWith('/decouvrir',{replace:true});
 }
});
