import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {DbMenuItem} from '@/types/database';
import type {UniversalCustomizationData} from '@/types/customization';
import fr from '@/i18n/fr.json';
const cart=vi.hoisted(()=>({addItem:vi.fn()}));
vi.mock('@/context/CartContext',()=>({useCart:()=>cart}));
vi.mock('@/context/LanguageContext',()=>({useLanguage:()=>({language:'fr',tMenu:(item:DbMenuItem)=>item,t:(key:string,params:Record<string,string>={})=>Object.entries(params).reduce((value,[key,replacement])=>value.split(`{${key}}`).join(replacement),(fr as Record<string,string>)[key]??key)})}));
vi.mock('framer-motion',async()=>{const {forwardRef}=await import('react');return {useReducedMotion:()=>false,AnimatePresence:({children}:{children:React.ReactNode})=>children,motion:{div:forwardRef<HTMLDivElement,React.HTMLAttributes<HTMLDivElement>&{initial?:unknown;animate?:unknown;exit?:unknown;transition?:unknown;variants?:unknown}>(({children,initial,animate,exit,transition,variants,...props},ref)=><div {...props} ref={ref}>{children}</div>)}};});
import {ProductCustomizer} from '@/components/ProductCustomizer';
afterEach(()=>{cleanup();cart.addItem.mockClear();});
function setup(type:'tacos'|'assiette',name=type==='tacos'?'Tacos':'Assiette'){
 const item={id:'item',name,price:0,product_type:type,enabled:true} as DbMenuItem;
 const data={cuisine_type:'kebab',bases:[{id:'base',restaurant_id:'restaurant',name:type==='tacos'?'Normal':'Grande',group:type,price:type==='tacos'?8:11,max_viandes:3,enabled:true,name_translations:{},image:null,sort_order:0}],viandes:['Kebab','Poulet','Steak','Merguez'].map((name,index)=>({id:'meat-'+index,restaurant_id:'restaurant',name,name_translations:{},supplement:0,enabled:true,image:null,sort_order:index})),garnitures:[],sauces:[],accompagnements:[],config:null,stepTemplates:[
 {id:'base-step',cuisine_type:'kebab',step_key:'base',label_i18n:'custom.choose_size',data_source:'restaurant_bases',step_type:'single_select',sort_order:0,required:true,config:{}},
 {id:'meat-step',cuisine_type:'kebab',step_key:'viande',label_i18n:'custom.choose_meat',data_source:'restaurant_viandes',step_type:'multi_select',sort_order:1,required:true,config:{max_from_base:true,extra_viande_price:2}},
 {id:'recap-step',cuisine_type:'kebab',step_key:'recap',label_i18n:'custom.recap',data_source:'none',step_type:'recap',sort_order:2,required:false,config:{}},
 ]} satisfies UniversalCustomizationData;
 render(<ProductCustomizer item={item} open onClose={()=>{}} restaurantId="restaurant" restaurantSlug="demo" customizationData={data} menuItems={[]} primaryColor="#10B981"/>);
 fireEvent.click(screen.getByRole('button',{name:new RegExp(type==='tacos'?'^Normal':'^Grande')}));
 return {next:()=>screen.getByTestId('customizer-next'),choose:(name:string)=>fireEvent.click(screen.getByRole('button',{name:new RegExp('^'+name)}))};
}
describe('customer meat counts and their canonical displayed prices',()=>{
 for(const type of ['tacos','assiette'] as const)for(const count of [1,2,3])it(`${type} allows ${count} meats and charges its matching price`,()=>{
  const ui=setup(type);expect(ui.next()).toBeDisabled();
  for(const name of ['Kebab','Poulet','Steak'].slice(0,count))ui.choose(name);
  expect(ui.next()).toBeEnabled();fireEvent.click(ui.next());
  const price=(type==='tacos'?8:11)+(count-1)*2;
  expect(screen.getByTestId('customizer-add')).toHaveTextContent(`${price.toFixed(2)} €`);
  fireEvent.click(screen.getByTestId('customizer-add'));
  expect(cart.addItem).toHaveBeenCalledOnce();const ordered=cart.addItem.mock.calls[0][0];const options=cart.addItem.mock.calls[0][5];expect(ordered.price+options.extraCost).toBe(price);
  expect(options.customChoices.find((step:{stepKey:string})=>step.stepKey==='viande').selections).toHaveLength(count);
 });
 it('prevents a fourth different meat and cannot proceed with zero',()=>{
  const ui=setup('tacos');expect(ui.next()).toBeDisabled();for(const name of ['Kebab','Poulet','Steak','Merguez'])ui.choose(name);
  expect(ui.next()).toBeEnabled();fireEvent.click(ui.next());fireEvent.click(screen.getByTestId('customizer-add'));
  const ordered=cart.addItem.mock.calls[0][0];const options=cart.addItem.mock.calls[0][5];expect(ordered.price+options.extraCost).toBe(12);expect(options.customChoices.find((step:{stepKey:string})=>step.stepKey==='viande').selections).toHaveLength(3);
 });
 it('keeps three meats mandatory for a product explicitly named three meats',()=>{
  const ui=setup('tacos','Tacos 3 viandes');for(const name of ['Kebab','Poulet'])ui.choose(name);expect(ui.next()).toBeDisabled();ui.choose('Steak');expect(ui.next()).toBeEnabled();
 });
});
