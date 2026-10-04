import {randomUuid} from '@/lib/uuid';
export type DemoSector='epicerie'|'fleuriste';
export type DemoProduct={id:string;nameKey:string;categoryKey:string;price:number;image:string};
export type CommerceDemoOrder={id:string;sector:DemoSector;number:number;createdAt:number;status:'new'|'preparing'|'ready'|'done';items:Record<string,number>;total:number};
export type CommerceDemoState={cart:Record<string,number>;orders:CommerceDemoOrder[]};
const catalogs:Record<DemoSector,{nameKey:string;hero:string;products:DemoProduct[]}>= {
 epicerie:{nameKey:'commerce.grocery_name',hero:'/images/commerce/grocery-basket.webp',products:[
  {id:'basket',nameKey:'commerce.product_basket',categoryKey:'commerce.fresh',price:12.9,image:'/images/commerce/grocery-basket.webp'},
  {id:'coca',nameKey:'commerce.product_coca',categoryKey:'commerce.drinks',price:1.8,image:'/images/brands/coca-cola.svg'},
  {id:'fanta',nameKey:'commerce.product_fanta',categoryKey:'commerce.drinks',price:1.8,image:'/images/brands/fanta.png'},
  {id:'water',nameKey:'commerce.product_water',categoryKey:'commerce.drinks',price:1.2,image:'/images/menu/water.webp'},
 ]},
 fleuriste:{nameKey:'commerce.florist_name',hero:'/images/commerce/seasonal-bouquet.webp',products:[
  {id:'bouquet',nameKey:'commerce.product_bouquet',categoryKey:'commerce.bouquets',price:26,image:'/images/commerce/seasonal-bouquet.webp'},
  {id:'roses',nameKey:'commerce.product_roses',categoryKey:'commerce.bouquets',price:32,image:'/images/commerce/rose-bouquet.webp'},
  {id:'orchid',nameKey:'commerce.product_orchid',categoryKey:'commerce.plants',price:22,image:'/images/commerce/white-orchid.webp'},
 ]},
};
export function demoCatalog(sector:DemoSector){const catalog=catalogs[sector];if(!catalog)throw new Error('Unknown demonstration');return catalog;}
const storageKey=(sector:DemoSector)=>'commandeici:commerce-demo:'+sector;
function validCart(sector:DemoSector,value:unknown):value is Record<string,number>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const ids=new Set(demoCatalog(sector).products.map(product=>product.id));
 return Object.entries(value).every(([id,quantity])=>ids.has(id)&&typeof quantity==='number'&&Number.isInteger(quantity)&&quantity>0&&quantity<=99);
}
export function commerceDemoTotal(sector:DemoSector,items:Record<string,number>):number{
 if(!validCart(sector,items))throw new Error('Invalid demonstration basket');
 return Math.round(demoCatalog(sector).products.reduce((total,product)=>total+product.price*(items[product.id]??0),0)*100)/100;
}
export function createCommerceDemoOrder(sector:DemoSector,items:Record<string,number>,number:number):CommerceDemoOrder{
 if(!Object.keys(items).length||!Number.isSafeInteger(number)||number<1)throw new Error('Invalid demonstration order');
 return {id:'demo-local-'+randomUuid(),sector,number,createdAt:Date.now(),status:'new',items:{...items},total:commerceDemoTotal(sector,items)};
}
export function advanceCommerceDemoOrder(order:CommerceDemoOrder):CommerceDemoOrder{
 const status={new:'preparing',preparing:'ready',ready:'done',done:'done'} as const;
 return {...order,status:status[order.status]};
}
function validOrder(sector:DemoSector,value:unknown):value is CommerceDemoOrder{
 if(!value||typeof value!=='object')return false;
 const order=value as CommerceDemoOrder;
 return typeof order.id==='string'&&/^demo-local-[0-9a-f-]{36}$/.test(order.id)&&order.sector===sector&&Number.isSafeInteger(order.number)&&order.number>0
  &&Number.isFinite(order.createdAt)&&order.createdAt<=Date.now()+60000&&order.createdAt>Date.now()-6*60*60*1000
  &&['new','preparing','ready','done'].includes(order.status)&&validCart(sector,order.items)&&Object.keys(order.items).length>0
  &&Number.isFinite(order.total)&&order.total===commerceDemoTotal(sector,order.items);
}
export function loadCommerceDemo(sector:DemoSector):CommerceDemoState{
 try {
  const raw=sessionStorage.getItem(storageKey(sector));if(!raw||raw.length>40000)return {cart:{},orders:[]};
  const value=JSON.parse(raw);if(!value||typeof value!=='object')return {cart:{},orders:[]};
  const orders=Array.isArray(value.orders)?value.orders.filter((order:unknown)=>validOrder(sector,order)).slice(0,20):[];
  return {cart:validCart(sector,value.cart)?value.cart:{},orders};
 }catch{return {cart:{},orders:[]};}
}
export function saveCommerceDemo(sector:DemoSector,state:CommerceDemoState):void{
 try {if(!validCart(sector,state.cart))return;const orders=state.orders.filter(order=>validOrder(sector,order)).slice(0,20);sessionStorage.setItem(storageKey(sector),JSON.stringify({cart:state.cart,orders}));}catch{/* A demonstration remains usable when local preferences are blocked. */}
}
