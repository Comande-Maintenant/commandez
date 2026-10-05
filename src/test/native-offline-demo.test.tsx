import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const f=vi.hoisted(() => ({path:'/demo',cartId:null as string|null}));
vi.mock('@capacitor/core', () => ({Capacitor:{isNativePlatform:()=>true}}));
vi.mock('@/lib/native', () => ({isNative:()=>true,nativeRoute:()=>null}));
vi.mock('@/context/LanguageContext', () => ({useLanguage:()=>({t:(key:string)=>key})}));
vi.mock('react-router-dom', () => ({useNavigate:()=>vi.fn(),useLocation:()=>({pathname:f.path})}));
vi.mock('@capacitor/app', () => ({App:{addListener:vi.fn().mockResolvedValue({remove:vi.fn()}),getLaunchUrl:vi.fn().mockResolvedValue(null)}}));
vi.mock('@capacitor/network', () => ({Network:{getStatus:vi.fn().mockResolvedValue({connected:false}),addListener:vi.fn().mockResolvedValue({remove:vi.fn()})}}));
vi.mock('@/integrations/supabase/client', () => ({supabase:{auth:{startAutoRefresh:vi.fn(),stopAutoRefresh:vi.fn()}}}));
vi.mock('@/context/CartContext',()=>({useCart:()=>({restaurantId:f.cartId})}));
import { NativeLifecycle } from '@/components/NativeLifecycle';
beforeEach(()=>{vi.restoreAllMocks();localStorage.clear();f.cartId=null;});
afterEach(cleanup);
for(const path of ['/demo','/admin/demo','/demo/epicerie','/demo/fleuriste','/suivi/demo-local-fixture']) it(`keeps ${path} unobstructed while the demonstration works offline`,async()=>{
  f.path=path;render(<NativeLifecycle/>);await act(async()=>{await Promise.resolve();});
  expect(screen.queryByText('native.offline')).not.toBeInTheDocument();
});
for(const id of ['demo-restaurant-antalya','real-merchant']) it(`keeps the appropriate offline message for checkout ${id}`,async()=>{
  f.path='/order';f.cartId=id;localStorage.setItem('resto-order-cart',JSON.stringify({restaurantId:id}));
  render(<NativeLifecycle/>);await act(async()=>{await Promise.resolve();});
  expect(Boolean(screen.queryByText('native.offline'))).toBe(id==='real-merchant');
});

it('keeps the in-memory demo checkout usable when preferences storage is blocked',async()=>{
 f.path='/order';f.cartId='demo-restaurant-antalya';vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('Blocked');});
 render(<NativeLifecycle/>);await act(async()=>{await Promise.resolve();});expect(screen.queryByText('native.offline')).not.toBeInTheDocument();vi.restoreAllMocks();
});
