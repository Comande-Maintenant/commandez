import {randomUuid} from '@/lib/uuid';

export type DemoSector = 'epicerie' | 'fleuriste';
export type DemoChoice = {id: string; labelKey: string; extraCents: number};
export type DemoOption = {id: string; labelKey: string; choices: DemoChoice[]};
export type DemoProduct = {
 id: string; nameKey: string; categoryKey: string; descriptionKey: string; unitKey: string;
 price: number; image: string; stock: number; options: DemoOption[]; giftNote: boolean;
};
export type CommerceProductState = {priceCents: number; stock: number; enabled: boolean};
export type CommerceDemoLine = {
 key: string; productId: string; choices: Record<string,string>; note: string; quantity: number;
 basePriceCents: number; unitPriceCents: number;
};
export type DemoPickup = 'soon' | '30' | '60';
export type CommerceDemoOrder = {
 id: string; sector: DemoSector; number: number; createdAt: number; status: 'new'|'preparing'|'ready'|'done';
 items: Record<string,number>; lines: CommerceDemoLine[]; total: number; pickup: DemoPickup;
 paidVia?: 'cash'|'card'; completedAt?: number;
};
export type CommerceDemoState = {
 version: 2; cart: CommerceDemoLine[]; orders: CommerceDemoOrder[];
 products: Record<string,CommerceProductState>; pickup: DemoPickup;
};
const option = (id:string,labelKey:string,choices:[string,string,number][]):DemoOption => ({
 id,labelKey:'commerce.'+labelKey,choices:choices.map(([id,label,extraCents])=>({id,labelKey:'commerce.'+label,extraCents})),
});
const size = option('size','size',[['standard','size_standard',0],['generous','size_generous',1200],['large','size_large',2400]]);
const finish = option('finish','finish',[['paper','finish_paper',0],['wrapped','finish_wrapped',250],['vase','finish_vase',800]]);
const palette = option('palette','palette',[['colorful','palette_colorful',0],['pastel','palette_pastel',0],['white','palette_white',0]]);
const product = (id:string,name:string,category:string,price:number,unit:string,options:DemoOption[]=[],giftNote=false):DemoProduct => ({
 id,nameKey:'commerce.product_'+name,categoryKey:'commerce.'+category,descriptionKey:'commerce.desc_'+name,
 unitKey:'commerce.'+unit,price,image:'/images/commerce/'+id+'.webp',stock:12,options,giftNote,
});
const catalogs:Record<DemoSector,{nameKey:string; hero:string; products:DemoProduct[]}> = {
 epicerie:{nameKey:'commerce.grocery_name',hero:'/images/commerce/grocery-basket.webp',products:[
  {...product('basket','basket','fresh',12.9,'unit_basket'),image:'/images/commerce/grocery-basket.webp'},
  product('tomatoes','tomatoes','fresh',3.9,'unit_500g',[option('format','format',[['500g','unit_500g',0],['1kg','unit_1kg',390]])]),
  product('apples','apples','fresh',2.6,'unit_1kg',[option('format','format',[['1kg','unit_1kg',0],['2kg','unit_2kg',260]])]),
  product('strawberries','strawberries','fresh',4.5,'unit_250g',[option('format','format',[['250g','unit_250g',0],['500g','unit_500g',450]])]),
  product('bread','bread','bakery',4.2,'unit_duo'),
  product('cheese','cheese','dairy',4.9,'unit_200g',[option('format','format',[['200g','unit_200g',0],['400g','unit_400g',490]])]),
  product('eggs','eggs','dairy',3.2,'unit_6',[option('format','format',[['6','unit_6',0],['12','unit_12',320]])]),
  {...product('coca','coca','drinks',1.8,'unit_33cl'),image:'/images/brands/coca-cola.svg'},
  {...product('fanta','fanta','drinks',1.8,'unit_33cl'),image:'/images/brands/fanta.png'},
  {...product('water','water','drinks',1.2,'unit_50cl'),image:'/images/menu/water.webp'},
 ]},
 fleuriste:{nameKey:'commerce.florist_name',hero:'/images/commerce/seasonal-bouquet.webp',products:[
  {...product('bouquet','bouquet','bouquets',26,'unit_bouquet',[size,palette,finish],true),image:'/images/commerce/seasonal-bouquet.webp'},
  {...product('roses','roses','bouquets',32,'unit_bouquet',[size,option('palette','palette',[['red','palette_red',0],['pink','palette_pink',0],['white','palette_white',0]]),finish],true),image:'/images/commerce/rose-bouquet.webp'},
  product('tulips','tulips','bouquets',18,'unit_bouquet',[option('size','size',[['10','tulips_10',0],['20','tulips_20',1500]]),finish],true),
  product('dried-bouquet','dried','bouquets',29,'unit_bouquet',[size,finish],true),
  {...product('orchid','orchid','plants',22,'unit_each',[option('pot','pot',[['simple','pot_simple',0],['decorative','pot_decorative',400]])],true),image:'/images/commerce/white-orchid.webp'},
  product('succulent','succulent','plants',12,'unit_each',[],true),
  product('eucalyptus','eucalyptus','accessories',9,'unit_bunch'),
  product('vase','vase','accessories',8,'unit_each'),
 ]},
};
const MAX_LINES=30, MAX_ORDERS=20, MAX_STORAGE=200000;
const storageKey=(sector:DemoSector)=>'commandeici:commerce-demo:'+sector;
const integer=(value:unknown,min:number,max:number):value is number => typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
const object=(value:unknown):value is Record<string,unknown> => Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const pickupValid=(value:unknown):value is DemoPickup => value==='soon'||value==='30'||value==='60';
export function demoCatalog(sector:DemoSector) {
 if(sector!=='epicerie'&&sector!=='fleuriste')throw new Error('Unknown demonstration');
 const catalog=catalogs[sector];if(!catalog)throw new Error('Unknown demonstration');return catalog;
}
export function initialCommerceDemoState(sector:DemoSector):CommerceDemoState {
 return {version:2,cart:[],orders:[],pickup:'soon',products:Object.fromEntries(demoCatalog(sector).products.map(p=>[p.id,{priceCents:Math.round(p.price*100),stock:p.stock,enabled:true}]))};
}
function knownProduct(sector:DemoSector,id:string) {
 const found=demoCatalog(sector).products.find(p=>p.id===id);if(!found)throw new Error('Invalid demonstration product');return found;
}
function validProductState(value:unknown):value is CommerceProductState {
 return object(value)&&integer(value.priceCents,0,100000)&&integer(value.stock,0,999)&&typeof value.enabled==='boolean';
}
function lineKey(productId:string,choices:Record<string,string>,note:string) {
 return JSON.stringify([productId,Object.entries(choices).sort(([a],[b])=>a.localeCompare(b)),note]);
}
export function configureCommerceLine(sector:DemoSector,productId:string,choices:Record<string,string>={},note='',quantity=1,products?:Record<string,CommerceProductState>):CommerceDemoLine {
 const p=knownProduct(sector,productId);
 if(!object(choices)||Object.keys(choices).some(id=>!p.options.some(option=>option.id===id)))throw new Error('Invalid demonstration options');
 if(!integer(quantity,1,99)||typeof note!=='string'||note.length>160||(!p.giftNote&&note.trim()))throw new Error('commerce.invalid_value');
 const base=products?.[p.id]??{priceCents:Math.round(p.price*100),stock:p.stock,enabled:true};if(!validProductState(base))throw new Error('commerce.invalid_value');
 const selected:Record<string,string>={};let extra=0;
 for(const group of p.options) {
  const selectedId=Object.prototype.hasOwnProperty.call(choices,group.id)?choices[group.id]:group.choices[0].id;
  const choice=group.choices.find(choice=>choice.id===selectedId);if(!choice)throw new Error('Invalid demonstration option');
  selected[group.id]=choice.id;extra+=choice.extraCents;
 }
 const cleaned=note.trim();return {key:lineKey(p.id,selected,cleaned),productId:p.id,choices:selected,note:cleaned,quantity,basePriceCents:base.priceCents,unitPriceCents:base.priceCents+extra};
}
function parseLine(sector:DemoSector,value:unknown,products?:Record<string,CommerceProductState>):CommerceDemoLine|null {
 if(!object(value)||typeof value.productId!=='string'||typeof value.note!=='string'||!object(value.choices)||!integer(value.quantity,1,99)||!integer(value.basePriceCents,0,100000))return null;
 try {
  const state=products??{[value.productId]:{priceCents:value.basePriceCents,stock:999,enabled:true}};
  const line=configureCommerceLine(sector,value.productId,value.choices as Record<string,string>,value.note,value.quantity,state);
  if(line.key!==value.key||line.note!==value.note||line.basePriceCents!==value.basePriceCents||line.unitPriceCents!==value.unitPriceCents)return null;
  return line;
 }catch{return null;}
}
function parseLines(sector:DemoSector,value:unknown,products?:Record<string,CommerceProductState>):CommerceDemoLine[]|null {
 if(!Array.isArray(value)||value.length>MAX_LINES)return null;
 const lines:CommerceDemoLine[]=[],keys=new Set<string>();
 for(const entry of value){const line=parseLine(sector,entry,products);if(!line||keys.has(line.key))return null;keys.add(line.key);lines.push(line);}
 return lines;
}
function legacyLines(sector:DemoSector,value:unknown):CommerceDemoLine[]|null {
 if(!object(value)||Object.keys(value).length>demoCatalog(sector).products.length)return null;
 try {return Object.entries(value).map(([id,quantity])=>{if(!integer(quantity,1,99))throw new Error('Invalid quantity');return configureCommerceLine(sector,id,{},'',quantity);});}catch{return null;}
}
export function commerceDemoTotal(sector:DemoSector,items:Record<string,number>|CommerceDemoLine[]):number {
 const lines=Array.isArray(items)?parseLines(sector,items):legacyLines(sector,items);
 if(!lines)throw new Error('Invalid demonstration basket');return lines.reduce((sum,line)=>sum+line.unitPriceCents*line.quantity,0)/100;
}
function aggregate(lines:CommerceDemoLine[]):Record<string,number> {
 const items:Record<string,number>={};for(const line of lines)items[line.productId]=(items[line.productId]??0)+line.quantity;return items;
}
export function createCommerceDemoOrder(sector:DemoSector,items:Record<string,number>|CommerceDemoLine[],number:number,pickup:DemoPickup='soon'):CommerceDemoOrder {
 const lines=Array.isArray(items)?parseLines(sector,items):legacyLines(sector,items);
 if(!lines?.length||!integer(number,1,1000000)||!pickupValid(pickup))throw new Error('Invalid demonstration order');
 return {id:'demo-local-'+randomUuid(),sector,number,createdAt:Date.now(),status:'new',items:aggregate(lines),lines,total:commerceDemoTotal(sector,lines),pickup};
}
export function advanceCommerceDemoOrder(order:CommerceDemoOrder):CommerceDemoOrder {
 const status={new:'preparing',preparing:'ready',ready:'done',done:'done'} as const;
 if(!Object.prototype.hasOwnProperty.call(status,order.status))throw new Error('Invalid demonstration status');
 if(order.status==='done')return order;
 return {...order,status:status[order.status],...(order.status==='ready'?{paidVia:'cash' as const,completedAt:Date.now()}:{})};
}
export function commerceBasketAvailable(state:CommerceDemoState):boolean {
 if(!state.cart.length)return false;
 return Object.entries(aggregate(state.cart)).every(([id,quantity])=>state.products[id]?.enabled&&state.products[id].stock>=quantity);
}
export function addCommerceDemoLine(sector:DemoSector,state:CommerceDemoState,input:CommerceDemoLine):CommerceDemoState {
 const line=configureCommerceLine(sector,input.productId,input.choices,input.note,input.quantity,state.products);
 const cart=state.cart.map(current=>({...current,choices:{...current.choices}}));const existing=cart.find(current=>current.key===line.key);
 if(existing){if(existing.quantity+line.quantity>99)throw new Error('commerce.invalid_value');existing.quantity+=line.quantity;}else {if(cart.length>=MAX_LINES)throw new Error('commerce.invalid_value');cart.push(line);}
 const next={...state,cart};if(!commerceBasketAvailable(next))throw new Error('commerce.unavailable');return next;
}
export function changeCommerceDemoQuantity(sector:DemoSector,state:CommerceDemoState,key:string,delta:1|-1):CommerceDemoState {
 if(delta!==1&&delta!==-1)throw new Error('commerce.invalid_value');
 const line=state.cart.find(line=>line.key===key);if(!line)throw new Error('Invalid demonstration line');
 if(delta===1)return addCommerceDemoLine(sector,state,{...line,quantity:1});
 return {...state,cart:state.cart.flatMap(current=>current.key!==key?[current]:current.quantity===1?[]:[{...current,quantity:current.quantity-1}])};
}
function reserve(sector:DemoSector,state:CommerceDemoState,lines:CommerceDemoLine[],pickup:DemoPickup):CommerceDemoState {
 const candidate={...state,cart:lines};if(!commerceBasketAvailable(candidate))throw new Error('commerce.adjust_basket');
 const order=createCommerceDemoOrder(sector,lines,1+Math.max(0,...state.orders.map(order=>order.number)),pickup);
 const products={...state.products};for(const [id,quantity] of Object.entries(order.items))products[id]={...products[id],stock:products[id].stock-quantity};
 return {...state,products,orders:[order,...state.orders].slice(0,MAX_ORDERS)};
}
export function submitCommerceDemoOrder(sector:DemoSector,state:CommerceDemoState,pickup:DemoPickup):CommerceDemoState {
 const lines=parseLines(sector,state.cart,state.products);if(!lines?.length)throw new Error('commerce.adjust_basket');
 return {...reserve(sector,state,lines,pickup),cart:[],pickup};
}
export function receiveCommerceDemoSample(sector:DemoSector,state:CommerceDemoState):CommerceDemoState {
 const p=demoCatalog(sector).products.find(p=>state.products[p.id]?.enabled&&state.products[p.id].stock>0);if(!p)throw new Error('commerce.unavailable');
 return reserve(sector,state,[configureCommerceLine(sector,p.id,{},'',1,state.products)],'soon');
}
export function updateCommerceDemoProduct(sector:DemoSector,state:CommerceDemoState,id:string,patch:Partial<CommerceProductState>):CommerceDemoState {
 knownProduct(sector,id);const next={...state.products[id],...patch};if(!validProductState(next))throw new Error('commerce.invalid_value');
 const products={...state.products,[id]:next};return {...state,products,cart:state.cart.map(line=>configureCommerceLine(sector,line.productId,line.choices,line.note,line.quantity,products))};
}
export function collectCommerceDemoOrder(state:CommerceDemoState,id:string,paidVia:'cash'|'card'):CommerceDemoState {
 const order=state.orders.find(order=>order.id===id);if(!order||order.status!=='ready'||!['cash','card'].includes(paidVia))throw new Error('Invalid demonstration collection');
 return {...state,orders:state.orders.map(current=>current.id===id?{...current,status:'done',paidVia,completedAt:Date.now()}:current)};
}
function parseOrder(sector:DemoSector,value:unknown):CommerceDemoOrder|null {
 if(!object(value)||typeof value.id!=='string'||!/^demo-local-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id)||value.sector!==sector||!integer(value.number,1,1000000)
  ||typeof value.createdAt!=='number'||!Number.isFinite(value.createdAt)||value.createdAt>Date.now()+60000||value.createdAt<Date.now()-6*60*60*1000
  ||typeof value.status!=='string'||!['new','preparing','ready','done'].includes(value.status))return null;
 const lines=value.lines===undefined?legacyLines(sector,value.items):parseLines(sector,value.lines);if(!lines?.length)return null;
 const total=commerceDemoTotal(sector,lines);if(total!==value.total)return null;
 if(value.pickup!==undefined&&!pickupValid(value.pickup))return null;
 if(value.paidVia!==undefined&&(typeof value.paidVia!=='string'||!['cash','card'].includes(value.paidVia)))return null;
 if(value.completedAt!==undefined&&(typeof value.completedAt!=='number'||!Number.isFinite(value.completedAt)||value.completedAt<value.createdAt||value.completedAt>Date.now()+60000))return null;
 const done=value.status==='done';
 return {id:value.id,sector,number:value.number,createdAt:value.createdAt,status:value.status as CommerceDemoOrder['status'],lines,items:aggregate(lines),total,pickup:pickupValid(value.pickup)?value.pickup:'soon',
  ...(done?{paidVia:value.paidVia==='card'?'card':'cash',completedAt:typeof value.completedAt==='number'?value.completedAt:value.createdAt}:{})};
}
export function loadCommerceDemo(sector:DemoSector):CommerceDemoState {
 const fallback=initialCommerceDemoState(sector);
 try {
  const raw=sessionStorage.getItem(storageKey(sector));if(!raw||raw.length>MAX_STORAGE)return fallback;const value:unknown=JSON.parse(raw);if(!object(value))return fallback;
  if(value.version!==undefined&&value.version!==2)return fallback;
  const products={...fallback.products};
  if(value.version===2&&object(value.products))for(const p of demoCatalog(sector).products){const entry=value.products[p.id];if(validProductState(entry))products[p.id]={priceCents:entry.priceCents,stock:entry.stock,enabled:entry.enabled};}
  const keys=new Set<string>(),numbers=new Set<number>();
  const orders=Array.isArray(value.orders)?value.orders.slice(0,MAX_ORDERS).flatMap(raw=>{const order=parseOrder(sector,raw);if(!order||keys.has(order.id)||numbers.has(order.number))return [];keys.add(order.id);numbers.add(order.number);return [order];}).sort((a,b)=>b.createdAt-a.createdAt||b.number-a.number):[];
  if(value.version===undefined)for(const order of orders)for(const [id,quantity] of Object.entries(order.items))products[id]={...products[id],stock:Math.max(0,products[id].stock-quantity)};
  const cart=value.version===2?parseLines(sector,value.cart,products):legacyLines(sector,value.cart);
  return {version:2,products,orders,cart:cart??[],pickup:pickupValid(value.pickup)?value.pickup:'soon'};
 }catch{return fallback;}
}
export function saveCommerceDemo(sector:DemoSector,state:CommerceDemoState):void {
 try {
  const cart=parseLines(sector,state.cart,state.products);if(!cart)return;
  const products=Object.fromEntries(demoCatalog(sector).products.map(p=>{const current=state.products[p.id];if(!validProductState(current))throw new Error('Invalid product');return [p.id,{priceCents:current.priceCents,stock:current.stock,enabled:current.enabled}];}));
  const orders=state.orders.flatMap(order=>{const checked=parseOrder(sector,order);return checked?[checked]:[];}).slice(0,MAX_ORDERS);
  let raw=JSON.stringify({version:2,products,cart,orders,pickup:pickupValid(state.pickup)?state.pickup:'soon'});
  while(raw.length>MAX_STORAGE&&orders.length){orders.pop();raw=JSON.stringify({version:2,products,cart,orders,pickup:state.pickup});}
  if(raw.length<=MAX_STORAGE)sessionStorage.setItem(storageKey(sector),raw);
 }catch{/* A demonstration remains usable when local preferences are blocked. */}
}
