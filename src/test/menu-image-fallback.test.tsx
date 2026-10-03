import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>key})}));
import {MenuItemImage} from '@/components/MenuItemImage';
afterEach(cleanup);
it('replaces a broken restaurant photo with the bundled illustration, then a safe placeholder',()=>{
 render(<MenuItemImage item={{name:'Kebab',image:'https://restaurant.example/broken.jpg'}}/>);
 expect(screen.getByRole('img')).toHaveAttribute('src','https://restaurant.example/broken.jpg');
 fireEvent.error(screen.getByRole('img'));expect(screen.getByRole('img')).toHaveAttribute('src','/images/menu/kebab.webp');
 fireEvent.error(screen.getByRole('img'));expect(screen.getByRole('img',{name:'Kebab'})).not.toHaveAttribute('src');
});
it('retains the real photo even when its name matches a branded drink',()=>{
 render(<MenuItemImage item={{name:'Coca Cola',image:'https://restaurant.example/my-can.jpg'}}/>);
 expect(screen.getByRole('img')).toHaveAttribute('src','https://restaurant.example/my-can.jpg');
});
