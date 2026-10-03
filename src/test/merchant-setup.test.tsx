import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import fr from '@/i18n/fr.json';
import type {DbRestaurant} from '@/types/database';
const f=vi.hoisted(()=>({menu:vi.fn()}));
vi.mock('@/lib/api',()=>({fetchMenuItems:f.menu}));
vi.mock('@/lib/native',()=>({isNative:()=>false}));
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>(fr as Record<string,string>)[key]??key})}));
import {MerchantSetup} from '@/components/dashboard/MerchantSetup';
const restaurant={id:'r',slug:'my-restaurant',owner_id:'owner'} as DbRestaurant;
afterEach(()=>{cleanup();vi.resetAllMocks();localStorage.clear();});
it('uses an enabled menu and requires explicit confirmation of preview and sharing',async()=>{
 f.menu.mockResolvedValue([{enabled:true,product_type:'simple'}]);const navigate=vi.fn();
 render(<MemoryRouter><MerchantSetup restaurant={restaurant} ownerUserId="owner" onNavigate={navigate}/></MemoryRouter>);
 await screen.findByRole('checkbox',{name:'J’ai vérifié ma page'});
 expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
 fireEvent.click(screen.getByRole('button',{name:'Partager mon lien et mon QR code'}));expect(navigate).toHaveBeenCalledWith('qrcodes');
 expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
 fireEvent.click(screen.getByRole('checkbox',{name:'J’ai vérifié ma page'}));
 fireEvent.click(screen.getByRole('checkbox',{name:'J’ai partagé mon lien'}));
 expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','3');
});
it('does not read a different owner’s menu or display a stale owner guide',()=>{
 render(<MemoryRouter><MerchantSetup restaurant={restaurant} ownerUserId="another-owner" onNavigate={()=>{}}/></MemoryRouter>);
 expect(f.menu).not.toHaveBeenCalled();expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});
it('does not claim the menu is ready after a read error and provides a retry',async()=>{
 f.menu.mockRejectedValue(new Error('offline'));
 render(<MemoryRouter><MerchantSetup restaurant={restaurant} ownerUserId="owner" onNavigate={()=>{}}/></MemoryRouter>);
 expect(await screen.findByText('Impossible de vérifier la carte. Réessayez.')).toBeVisible();
 expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
 f.menu.mockResolvedValue([{enabled:true}]);fireEvent.click(screen.getByRole('button',{name:'Réessayer'}));
 await vi.waitFor(()=>expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1'));
});
it('keeps explicit confirmations on return and scopes them to the restaurant',async()=>{
 f.menu.mockResolvedValue([{enabled:true}]);
 const first=render(<MemoryRouter><MerchantSetup restaurant={restaurant} ownerUserId="owner" onNavigate={()=>{}}/></MemoryRouter>);
 const preview=await screen.findByRole('checkbox',{name:'J’ai vérifié ma page'});await vi.waitFor(()=>expect(preview).toBeEnabled());fireEvent.click(preview);first.unmount();
 const returned=render(<MemoryRouter><MerchantSetup restaurant={restaurant} ownerUserId="owner" onNavigate={()=>{}}/></MemoryRouter>);
 await vi.waitFor(()=>expect(screen.getByRole('checkbox',{name:'J’ai vérifié ma page'})).toBeChecked());returned.unmount();
 render(<MemoryRouter><MerchantSetup restaurant={{...restaurant,id:'other',slug:'other'}} ownerUserId="owner" onNavigate={()=>{}}/></MemoryRouter>);
 expect(await screen.findByRole('checkbox',{name:'J’ai vérifié ma page'})).not.toBeChecked();
});
it('does not mark a disabled-only menu as ready',async()=>{
 f.menu.mockResolvedValue([{enabled:false}]);
 render(<MemoryRouter><MerchantSetup restaurant={restaurant} ownerUserId="owner" onNavigate={()=>{}}/></MemoryRouter>);
 await vi.waitFor(()=>expect(f.menu).toHaveBeenCalled());
 expect(screen.getByRole('checkbox',{name:'J’ai vérifié ma page'})).toBeDisabled();expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
});
