import {useState} from 'react';
import {Minus,Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useLanguage} from '@/context/LanguageContext';
import {configureCommerceLine,type DemoSector,type DemoProduct,type CommerceDemoState,type CommerceDemoLine} from '@/lib/demo-commerce';
import {CommerceSheet} from './CommerceSheet';

export function CommerceProductSheet({sector,product,state,onClose,onAdd,returnFocus}: {
 sector:DemoSector;product:DemoProduct;state:CommerceDemoState;onClose:()=>void;
 onAdd:(line:CommerceDemoLine)=>boolean;returnFocus:HTMLElement|null;
}) {
 const {t,language}=useLanguage();const [choices,setChoices]=useState<Record<string,string>>({});const [note,setNote]=useState('');const [quantity,setQuantity]=useState(1);const [error,setError]=useState('');
 const remaining=state.products[product.id].enabled?Math.max(0,state.products[product.id].stock-state.cart.filter(line=>line.productId===product.id).reduce((sum,line)=>sum+line.quantity,0)):0;
 const line=configureCommerceLine(sector,product.id,choices,note,quantity,state.products);
 const price=(cents:number)=>new Intl.NumberFormat(language,{style:'currency',currency:'EUR'}).format(cents/100);
 const add=()=>{if(onAdd(line)){onClose();}else setError(t('commerce.unavailable'));};
 return <CommerceSheet open onClose={onClose} title={t(product.nameKey)} description={t(product.descriptionKey)} returnFocus={returnFocus}
  footer={<><div className="mb-3 flex items-center justify-between gap-3"><span className="text-sm text-slate-600">{t('commerce.quantity')}</span><div className="flex items-center gap-3">
   <button type="button" disabled={quantity<=1} onClick={()=>setQuantity(q=>q-1)} aria-label={t('commerce.decrease',{product:t(product.nameKey)})} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-100 disabled:opacity-40"><Minus className="h-4 w-4" aria-hidden="true"/></button><output className="min-w-5 text-center font-semibold" aria-label={t('commerce.quantity')}>{quantity}</output>
   <button type="button" disabled={quantity>=Math.min(remaining,99)} onClick={()=>setQuantity(q=>q+1)} aria-label={t('commerce.increase',{product:t(product.nameKey)})} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-100 disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden="true"/></button>
  </div></div><Button disabled={remaining<quantity} className="flex h-auto min-h-12 w-full justify-between gap-3 whitespace-normal rounded-xl py-3" onClick={add}><span>{t('commerce.add_to_basket')}</span><span>{price(line.unitPriceCents*quantity)}</span></Button></>}>
  <div className="relative mb-4 overflow-hidden rounded-2xl bg-[#f7f4ee]"><img src={product.image} width="640" height="640" alt={t(product.nameKey)} className={`aspect-[4/3] w-full ${product.categoryKey==='commerce.drinks'?'object-contain p-8':'object-cover'}`}/><span className="absolute bottom-0 inset-x-0 bg-black/45 px-2 text-center text-[10px] leading-5 text-white">{t('menu.illustration')}</span></div>
  <p className="mb-4 flex flex-wrap justify-between gap-2 text-sm text-slate-600"><span>{t(product.unitKey)}</span><span>{remaining?t('commerce.stock_left',{count:remaining}):t('commerce.sold_out')}</span></p>
  {product.options.map(group=><fieldset key={group.id} className="mb-5"><legend className="mb-2 font-semibold text-slate-900">{t(group.labelKey)}</legend><div className="space-y-2">{group.choices.map(choice=>{const selected=(choices[group.id]??group.choices[0].id)===choice.id;return <label key={choice.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${selected?'border-primary bg-primary/5':'border-slate-200'}`}><input type="radio" name={product.id+'-'+group.id} checked={selected} onChange={()=>setChoices(current=>({...current,[group.id]:choice.id}))} className="h-4 w-4 shrink-0 accent-primary"/><span className="min-w-0 flex-1 break-words">{t(choice.labelKey)}</span>{choice.extraCents>0&&<span className="shrink-0 text-slate-600">+{price(choice.extraCents)}</span>}</label>;})}</div></fieldset>)}
  {product.giftNote&&<div className="mb-3"><label htmlFor="commerce-gift-note" className="block font-semibold">{t('commerce.gift_note')}</label><p id="commerce-gift-hint" className="my-2 text-xs text-slate-500">{t('commerce.gift_note_hint')}</p><textarea id="commerce-gift-note" value={note} onChange={event=>setNote(event.target.value)} maxLength={160} rows={3} aria-describedby="commerce-gift-hint" className="w-full resize-y rounded-xl border border-slate-200 p-3 text-base"/><p className="text-end text-xs text-slate-500">{note.length}/160</p></div>}
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 </CommerceSheet>;
}
