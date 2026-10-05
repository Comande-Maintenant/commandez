import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import fr from '@/i18n/fr.json';
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>(fr as Record<string,string>)[key]??key})}));
vi.mock('@/context/CustomerAuthContext',()=>({useCustomerAuth:()=>({isLoggedIn:false,isLoading:true,user:null,profile:null,signUp:vi.fn()})}));
vi.mock('@/lib/api',()=>({fetchOrderById:()=>new Promise(()=>{}),subscribeToOrderStatus:()=>()=>{},fetchCustomerOrders:vi.fn()}));
import SuiviPage from '@/pages/SuiviPage';
import PhotoUploadPage from '@/pages/PhotoUploadPage';
import CustomerProfilePage from '@/pages/CustomerProfilePage';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState(null,'');});
for(const page of ['tracking','photos','profile'])it(`keeps ${page} loading escapable`,()=>{
 vi.stubGlobal('fetch',()=>new Promise(()=>{}));
 const paths={tracking:'/suivi/demo-local-order',photos:'/photos/demo?token=fixture',profile:'/profil'};
 render(<MemoryRouter initialEntries={[paths[page as keyof typeof paths]]}><Routes><Route path="/" element={<p>Accueil de sortie</p>}/><Route path="/suivi/:orderId" element={<SuiviPage/>}/><Route path="/photos/:restaurantId" element={<PhotoUploadPage/>}/><Route path="/profil" element={<CustomerProfilePage/>}/></Routes></MemoryRouter>);
 const back=screen.getByRole('button',{name:/^Retour$/});fireEvent.click(back);expect(screen.getByText('Accueil de sortie')).toBeVisible();
});
it('keeps an invalid photo link escapable',()=>{
 render(<MemoryRouter initialEntries={['/photos/demo']}><Routes><Route path="/" element={<p>Accueil de sortie</p>}/><Route path="/photos/:restaurantId" element={<PhotoUploadPage/>}/></Routes></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:/^Retour$/}));expect(screen.getByText('Accueil de sortie')).toBeVisible();
});
