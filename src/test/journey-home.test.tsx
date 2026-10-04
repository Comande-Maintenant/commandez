import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import fr from '@/i18n/fr.json';
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getUser:async()=>({data:{user:null}})}}}));
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>(fr as Record<string,string>)[key]??key})}));
import Index from '@/pages/Index';
afterEach(cleanup);
it('offers the experience before requiring a new restaurant account',async()=>{
 render(<MemoryRouter><Index/></MemoryRouter>);
 const demo=await screen.findByRole('button',{name:'Tester sans créer de compte'});
 expect(demo).toHaveAttribute('data-primary-action','demo');
 expect(screen.getByRole('button',{name:'Se connecter'})).toBeVisible();
 expect(screen.getByText('Gratuit jusqu’en 2027, sans carte bancaire.')).toBeVisible();
 expect(screen.getByRole('img',{name:'Un kebab et ses accompagnements'})).toBeVisible();
});
