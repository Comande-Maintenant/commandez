import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {createDemoOrder} from '@/lib/demo-order';
import fr from '@/i18n/fr.json';
import type {DbOrder} from '@/types/database';
const f=vi.hoisted(()=>({orders:[] as DbOrder[],receive:vi.fn()}));
vi.mock('@/context/RestaurantOrdersContext',()=>({useRestaurantOrderFeed:()=>({orders:f.orders,loading:false,receiveDemoOrder:f.receive})}));
vi.mock('@/lib/native',()=>({isNative:()=>false,openNotificationSettings:vi.fn()}));
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({t:(key:string,params:Record<string,string>={})=>Object.entries(params).reduce((value,[key,replacement])=>value.replace(`{${key}}`,replacement),(fr as Record<string,string>)[key]??key)})}));
import {DemoOrderControls} from '@/components/DemoOrderControls';
afterEach(()=>{cleanup();f.orders=[];vi.clearAllMocks();});
it('guides a first visitor without an overlay and receives a local sample on demand',()=>{
 render(<MemoryRouter><DemoOrderControls restaurantId="r" onNavigate={()=>{}}/></MemoryRouter>);
 expect(screen.getByRole('progressbar',{name:/commande/})).toHaveAttribute('aria-valuenow','0');
 fireEvent.click(screen.getByRole('button',{name:'Recevoir une commande'}));
 expect(f.receive).toHaveBeenCalledWith(expect.objectContaining({restaurant_id:'r',is_test:true,status:'new'}));
 expect(screen.getByRole('link',{name:'Voir côté client'})).toHaveAttribute('href','/demo');
});
it('uses the ready state to take the merchant to the till and offers signup only after completion',()=>{
 const order=createDemoOrder('r',1,{customer:'Demo',notes:''});f.orders=[{...order,status:'ready'}];const navigate=vi.fn();
 const {rerender}=render(<MemoryRouter><DemoOrderControls restaurantId="r" onNavigate={navigate}/></MemoryRouter>);
 expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','3');
 fireEvent.click(screen.getByRole('button',{name:'Passer en caisse'}));expect(navigate).toHaveBeenCalledWith('caisse');
 f.orders=[{...order,status:'done'}];rerender(<MemoryRouter><DemoOrderControls restaurantId="r" onNavigate={navigate}/></MemoryRouter>);
 expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','4');
 expect(screen.getByRole('link',{name:'Créer ma page gratuitement'})).toHaveAttribute('href','/inscription');
});
