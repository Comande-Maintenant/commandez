import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {DbOrder,DbRestaurant} from '@/types/database';
import fr from '@/i18n/fr.json';
const f=vi.hoisted(()=>({orders:[] as DbOrder[],loading:false}));
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>(fr as Record<string,string>)[key]??key,language:'fr'})}));
vi.mock('@/context/RestaurantOrdersContext',()=>({useRestaurantOrderFeed:()=>({orders:f.orders,loading:f.loading,setOrders:vi.fn(),disconnected:false})}));
vi.mock('@/lib/api',()=>({fetchMenuItems:vi.fn().mockResolvedValue([]),updateOrderStatus:vi.fn(),advanceDemoOrder:vi.fn()}));
vi.mock('@/components/dashboard/pos/POSOrderType',()=>({POSOrderType:()=> <div>Nouvelle vente</div>}));
import {AdminBottomNav} from '@/components/dashboard/AdminBottomNav';
import {AdminSidebar} from '@/components/dashboard/AdminSidebar';
import {DashboardPOS} from '@/components/dashboard/pos/DashboardPOS';
const restaurant={id:'r',owner_id:'o',slug:'r',name:'Demo',cuisine_type:'kebab',customization_config:{enabled:true,base_price:0,steps:[]}} as DbRestaurant;
const ready=()=>({id:'ready-order',restaurant_id:'r',order_number:1,status:'ready',items:[],total:10,created_at:new Date().toISOString(),customer_name:'Commande prête'} as DbOrder);
afterEach(()=>{cleanup();f.orders=[];f.loading=false;vi.clearAllMocks();});
for(const Nav of [AdminBottomNav,AdminSidebar])it(`${Nav.name} shows ready count on caisse and removes it after cashing`,()=>{
 const props={activeView:'cuisine' as const,onViewChange:vi.fn(),newOrderCount:0,readyOrderCount:2};
 const {rerender}=render(<Nav {...props}/>);expect(within(screen.getByRole('button',{name:/Caisse/})).getByText('2')).toBeVisible();
 rerender(<Nav {...props} readyOrderCount={0}/>);expect(within(screen.getByRole('button',{name:/Caisse/})).queryByText('2')).toBeNull();
});
it('opens ready orders on entering caisse instead of hiding them behind order taking',async()=>{
 f.orders=[ready()];render(<DashboardPOS restaurant={restaurant} isDemo/>);await act(async()=>{});
 expect(screen.getByRole('button',{name:/A encaisser/})).toHaveAttribute('aria-pressed','true');expect(screen.getByText('Commande prête')).toBeVisible();expect(screen.queryByText('Nouvelle vente')).toBeNull();
});
it('selects collection after the first snapshot arrives and then leaves a user choice alone',async()=>{
 f.loading=true;const {rerender}=render(<DashboardPOS restaurant={restaurant}/>);await act(async()=>{});
 f.loading=false;f.orders=[ready()];rerender(<DashboardPOS restaurant={restaurant}/>);await act(async()=>{});expect(screen.getByText('Commande prête')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:/Prise de commande/}));f.orders=[ready(),{...ready(),id:'second'}];rerender(<DashboardPOS restaurant={restaurant}/>);
 expect(screen.getByText('Nouvelle vente')).toBeVisible();expect(screen.queryByText('Commande prête')).toBeNull();
});
it('never switches a deliberately chosen order-taking screen when loading finishes',async()=>{
 f.loading=true;const {rerender}=render(<DashboardPOS restaurant={restaurant}/>);await act(async()=>{});fireEvent.click(screen.getByRole('button',{name:/Prise de commande/}));
 f.loading=false;f.orders=[ready()];rerender(<DashboardPOS restaurant={restaurant}/>);await act(async()=>{});expect(screen.getByText('Nouvelle vente')).toBeVisible();
});
it('keeps order taking when caisse is empty and does not interrupt it for a later ready order',async()=>{
 const {rerender}=render(<DashboardPOS restaurant={restaurant}/>);await act(async()=>{});expect(screen.getByText('Nouvelle vente')).toBeVisible();
 f.orders=[ready()];rerender(<DashboardPOS restaurant={restaurant}/>);expect(screen.getByText('Nouvelle vente')).toBeVisible();expect(screen.getByRole('button',{name:/A encaisser/})).toHaveTextContent('1');
});
