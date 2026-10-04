import {useState,type FormEvent} from 'react';
import {useLanguage} from '@/context/LanguageContext';
import {Button} from '@/components/ui/button';
import {type DemoProduct,type CommerceProductState} from '@/lib/demo-commerce';
import {CommerceSheet} from './CommerceSheet';
export function CommerceProductEdit({product,value,onClose,onSave,returnFocus}: {
 product:DemoProduct;value:CommerceProductState;onClose:()=>void;
 onSave:(patch:CommerceProductState)=>boolean;returnFocus:HTMLElement|null;
}) {
 const {t}=useLanguage();const [price,setPrice]=useState((value.priceCents/100).toFixed(2));const [stock,setStock]=useState(String(value.stock));const [enabled,setEnabled]=useState(value.enabled);const [error,setError]=useState('');
 const save=(event:FormEvent)=>{event.preventDefault();const cents=Math.round(Number(price.replace(',','.'))*100);const count=Number(stock);
  if(!/^\d+(?:[.,]\d{1,2})?$/.test(price)||!/^\d+$/.test(stock)||!Number.isSafeInteger(cents)||cents>100000||!Number.isSafeInteger(count)||count>999){setError(t('commerce.invalid_value'));return;}
  if(onSave({priceCents:cents,stock:count,enabled}))onClose();else setError(t('commerce.invalid_value'));
 };
 return <CommerceSheet open onClose={onClose} title={t('commerce.edit_title')} description={t('commerce.catalog_help')} returnFocus={returnFocus}
  footer={<Button type="submit" form="commerce-edit" className="h-auto min-h-12 w-full whitespace-normal rounded-xl py-3">{t('commerce.save_product')}</Button>}>
  <div className="mb-6 flex items-center gap-3"><img src={product.image} alt="" width="80" height="80" className="h-20 w-20 rounded-xl object-cover"/><h2 className="font-semibold">{t(product.nameKey)}</h2></div>
  <form id="commerce-edit" onSubmit={save} className="space-y-5">
   <div><label htmlFor="commerce-edit-price" className="mb-2 block text-sm font-semibold">{t('commerce.price_label')}</label><input id="commerce-edit-price" value={price} onChange={event=>setPrice(event.target.value)} inputMode="decimal" maxLength={8} className="min-h-12 w-full rounded-xl border border-slate-200 px-3 text-base"/></div>
   <div><label htmlFor="commerce-edit-stock" className="mb-2 block text-sm font-semibold">{t('commerce.stock_label')}</label><input id="commerce-edit-stock" value={stock} onChange={event=>setStock(event.target.value)} inputMode="numeric" maxLength={3} className="min-h-12 w-full rounded-xl border border-slate-200 px-3 text-base"/></div>
   <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)} className="h-4 w-4 accent-primary"/>{t('commerce.enabled_label')}</label>
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>
 </CommerceSheet>;
}
