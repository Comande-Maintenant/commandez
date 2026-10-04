import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import fr from '@/i18n/fr.json';
const f=vi.hoisted(()=>({update:vi.fn(),remove:vi.fn()}));
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>(fr as Record<string,string>)[key]??key,tMenu:(item:unknown)=>item,tText:(text:string)=>text})}));
vi.mock('@/context/CartContext',()=>({useCart:()=>({items:[{id:'cart-1',menuItem:{name:'Kebab',image:null},quantity:2,totalPrice:6.5,selectedSauces:[],selectedSupplements:[]}],totalItems:2,subtotal:13,updateQuantity:f.update,removeItem:f.remove,clearCart:vi.fn()})}));
import {CartSheet} from '@/components/CartSheet';
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('respects the merchant choice to hide product photographs',()=>{
 render(<MemoryRouter><CartSheet open showPhotos={false} onOpenChange={()=>{}}/></MemoryRouter>);
 expect(screen.queryByRole('img',{name:/Kebab/})).not.toBeInTheDocument();
});
it('keeps the product recognisable and quantity actions accessible without changing its total',()=>{
 render(<MemoryRouter><CartSheet open onOpenChange={()=>{}}/></MemoryRouter>);
 expect(screen.getByRole('img',{name:/Kebab/})).toBeVisible();
 const increase=screen.getByRole('button',{name:'Augmenter quantite'});
 expect(increase).toHaveClass('min-h-11');
 fireEvent.click(increase);expect(f.update).toHaveBeenCalledWith('cart-1',3);
 expect(screen.getByRole('button',{name:/Commander - 13.00/})).toBeVisible();
});
