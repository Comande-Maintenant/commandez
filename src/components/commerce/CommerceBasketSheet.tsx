import {Minus,Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useLanguage} from '@/context/LanguageContext';
import {commerceBasketAvailable,commerceDemoTotal,demoCatalog,type CommerceDemoState,type DemoSector,type DemoPickup} from '@/lib/demo-commerce';
import {CommerceSheet} from './CommerceSheet';
import {CommerceLineDetails} from './CommerceLineDetails';
export function CommerceBasketSheet({sector,state,onClose,onChange,onPickup,onSubmit,returnFocus}: {
 sector:DemoSector;state:CommerceDemoState;onClose:()=>void;onChange:(key:string,delta:1|-1)=>void;
 onPickup:(pickup:DemoPickup)=>void;onSubmit:()=>void;returnFocus:HTMLElement|null;
}) {
 const {t,language}=useLanguage();const catalog=demoCatalog(sector);const available=commerceBasketAvailable(state);
 const price=(cents:number)=>new Intl.NumberFormat(language,{style:'currency',currency:'EUR'}).format(cents/100);
 return <CommerceSheet open onClose={onClose} title={t('cart.your_cart')} description={t('commerce.pickup_note')} returnFocus={returnFocus}
  footer={<><p className="mb-3 text-xs leading-relaxed text-slate-500">{t('commerce.demo_note')}</p><Button disabled={!available} className="flex h-auto min-h-12 w-full justify-between gap-2 whitespace-normal rounded-xl py-3" onClick={onSubmit}><span>{t('commerce.simulate')}</span><span>{price(Math.round(commerceDemoTotal(sector,state.cart)*100))}</span></Button></>}>
  {!state.cart.length?<Button variant="outline" onClick={onClose} className="h-auto min-h-11 w-full whitespace-normal">{t('commerce.continue_shopping')}</Button>:<>
   <div className="space-y-3">{state.cart.map(line=>{const product=catalog.products.find(p=>p.id===line.productId)!;const amount=state.cart.filter(l=>l.productId===line.productId).reduce((sum,l)=>sum+l.quantity,0);return <article key={line.key} className="rounded-xl border border-slate-200 p-3"><div className="flex gap-3"><img src={product.image} alt="" width="56" height="56" className="h-14 w-14 shrink-0 rounded-lg object-cover"/><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{t(product.nameKey)}</h3><CommerceLineDetails line={line} product={product}/><p className="mt-1 text-sm font-semibold">{price(line.unitPriceCents*line.quantity)}</p></div></div><div className="mt-2 flex items-center justify-end gap-3"><button type="button" onClick={()=>onChange(line.key,-1)} aria-label={t('commerce.decrease',{product:t(product.nameKey)})} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-100"><Minus className="h-4 w-4" aria-hidden="true"/></button><span className="font-semibold">{line.quantity}</span><button type="button" disabled={!state.products[product.id].enabled||amount>=state.products[product.id].stock||line.quantity>=99} onClick={()=>onChange(line.key,1)} aria-label={t('commerce.increase',{product:t(product.nameKey)})} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-100 disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden="true"/></button></div></article>;})}</div>
   {!available&&<p role="alert" className="mt-4 text-sm text-red-700">{t('commerce.adjust_basket')}</p>}
   <fieldset className="mt-6"><legend className="mb-3 font-semibold">{t('commerce.pickup')}</legend><div className="space-y-2">{(['soon','30','60'] as const).map(pickup=><label key={pickup} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-sm ${state.pickup===pickup?'border-primary bg-primary/5':'border-slate-200'}`}><input type="radio" name="commerce-pickup" checked={state.pickup===pickup} onChange={()=>onPickup(pickup)} className="h-4 w-4 accent-primary"/>{t('commerce.pickup_'+pickup)}</label>)}</div></fieldset>
  </>}
 </CommerceSheet>;
}
