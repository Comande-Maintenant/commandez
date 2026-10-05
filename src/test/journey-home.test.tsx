import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import fr from '@/i18n/fr.json';
const f=vi.hoisted(()=>({user:vi.fn(),from:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getUser:f.user},from:f.from}}));
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>(fr as Record<string,string>)[key]??key})}));
import MerchantEntryPage from '@/pages/MerchantEntryPage';
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();f.user.mockResolvedValue({data:{user:null}});});
it('offers the experience before requiring a new restaurant account',async()=>{
 render(<MemoryRouter><MerchantEntryPage/></MemoryRouter>);
 await screen.findByRole('button',{name:'Se connecter'});
 const demo=await screen.findByRole('button',{name:'Tester sans créer de compte'});
 expect(demo).toHaveAttribute('data-primary-action','demo');
 expect(screen.getByRole('button',{name:'Se connecter'})).toBeVisible();
 expect(screen.getByText('Gratuit jusqu’en 2027, sans carte bancaire.')).toBeVisible();
 expect(screen.getByRole('img',{name:'Un kebab et ses accompagnements'})).toBeVisible();
});
it('offers an immediate exit into the demonstration while account checking is pending',async()=>{
 f.user.mockImplementation(()=>new Promise(()=>{}));
 render(<MemoryRouter><Routes><Route path="/" element={<MerchantEntryPage/>}/><Route path="/decouvrir" element={<p>Choisir un métier</p>}/></Routes></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Tester sans créer de compte'}));
 expect(screen.getByText('Choisir un métier')).toBeVisible();
});
it('does not leave the demonstration when a previous account lookup finishes after departure',async()=>{
 let resolve!: (value:unknown)=>void;
 f.user.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const query={select:()=>query,eq:()=>query,limit:vi.fn().mockResolvedValue({data:[{slug:'real-merchant'}]})};
 f.from.mockReturnValue(query);
 const view=render(<MemoryRouter><MerchantEntryPage/></MemoryRouter>);
 view.unmount();
 await act(async()=>{resolve({data:{user:{id:'owner'}}});await Promise.resolve();});
 expect(f.from).not.toHaveBeenCalled();
});

it('keeps pickup, no-delivery, signup and customer switching accessible during a stalled account lookup', () => {
 f.user.mockImplementation(() => new Promise(() => {}));
 render(<MemoryRouter><MerchantEntryPage/></MemoryRouter>);
 expect(screen.getByText('Recevez des commandes en ligne, vos clients récupèrent sur place.')).toBeVisible();
 expect(screen.getByText('CommandeIci n’organise pas de livraison.')).toBeVisible();
 expect(screen.getByRole('button', { name: fr['home.create_free'] })).toBeEnabled();
 expect(screen.getByRole('button', { name: 'Espace client' })).toBeEnabled();
});
