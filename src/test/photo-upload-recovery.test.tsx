import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import fr from '@/i18n/fr.json';
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>(fr as Record<string,string>)[key]??key})}));
import PhotoUploadPage from '@/pages/PhotoUploadPage';

afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
const ok=(data:unknown)=>Promise.resolve({ok:true,json:()=>Promise.resolve(data)});
async function setup(post:(options:RequestInit)=>Promise<unknown>){
 const fetch=vi.fn((_:unknown,options?:RequestInit)=>options?.method==='POST'?post(options):ok({restaurantName:'Commerce test',photos:[]}));vi.stubGlobal('fetch',fetch);
 const view=render(<MemoryRouter initialEntries={['/upload/fixture?token=local']}><Routes><Route path="/upload/:restaurantId" element={<PhotoUploadPage/>}/></Routes></MemoryRouter>);
 await screen.findByRole('button',{name:'Depuis la galerie'});
 const input=view.container.querySelector('input[type=file]') as HTMLInputElement;
 return {input,fetch};
}
const file=(name:string)=>new File(['fixture'],name,{type:'image/png'});
it('releases upload controls after a rejected request and permits a new selection without automatic retry',async()=>{
 const post=vi.fn().mockRejectedValueOnce(new TypeError('network unavailable')).mockImplementationOnce(()=>ok({url:'/second.png'}));
 const {input}=await setup(post);fireEvent.change(input,{target:{files:[file('first.png')]}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Depuis la galerie'})).toBeEnabled());
 expect(screen.getByRole('alert')).toHaveTextContent(fr['common.toast.upload_error']);expect(post).toHaveBeenCalledTimes(1);expect(input.value).toBe('');
 fireEvent.change(input,{target:{files:[file('second.png')]}});await screen.findByAltText('Photo 1');expect(post).toHaveBeenCalledTimes(2);expect(screen.queryByRole('alert')).toBeNull();
});
it('reports a non-success HTTP response without pretending the photo was uploaded',async()=>{
 const post=vi.fn(()=>Promise.resolve({ok:false,status:503}));const {input}=await setup(post);fireEvent.change(input,{target:{files:[file('first.png')]}});
 await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Prendre une photo'})).toBeEnabled();expect(screen.queryByAltText('Photo 1')).toBeNull();expect(post).toHaveBeenCalledTimes(1);
});
it('keeps confirmed partial successes and does not send the remainder of a failed batch',async()=>{
 const post=vi.fn().mockImplementationOnce(()=>ok({url:'/confirmed.png'})).mockRejectedValueOnce(new Error('offline'));const {input}=await setup(post);
 fireEvent.change(input,{target:{files:[file('confirmed.png'),file('failed.png'),file('unsent.png')]}});
 await screen.findByRole('alert');expect(screen.getByAltText('Photo 1')).toHaveAttribute('src','/confirmed.png');expect(post).toHaveBeenCalledTimes(2);expect(screen.getByRole('button',{name:'Depuis la galerie'})).toBeEnabled();
});
it('aborts a request that never responds and releases controls after the bounded delay',async()=>{
 const post=vi.fn((options:RequestInit)=>new Promise((_,reject)=>options.signal?.addEventListener('abort',()=>reject(new DOMException('Timed out','AbortError')))));
 const {input}=await setup(post);vi.useFakeTimers();fireEvent.change(input,{target:{files:[file('pending.png')]}});
 expect(screen.getByRole('button',{name:'Depuis la galerie'})).toBeDisabled();
 await act(async()=>{await vi.advanceTimersByTimeAsync(60_000);});
 expect(screen.getByRole('alert')).toBeVisible();expect(screen.getByRole('button',{name:'Depuis la galerie'})).toBeEnabled();expect(post).toHaveBeenCalledTimes(1);
});
