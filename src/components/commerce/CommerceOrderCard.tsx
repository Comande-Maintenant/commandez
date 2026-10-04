import {useLanguage} from '@/context/LanguageContext';
import {demoCatalog,type DemoSector,type CommerceDemoOrder} from '@/lib/demo-commerce';
import {CommerceLineDetails} from './CommerceLineDetails';
export function CommerceOrderCard({sector,order,children}: {sector:DemoSector;order:CommerceDemoOrder;children?:React.ReactNode}) {
 const {t,language}=useLanguage();const catalog=demoCatalog(sector);
 const price=new Intl.NumberFormat(language,{style:'currency',currency:'EUR'}).format(order.total);
 return <article className="rounded-2xl border border-slate-200 bg-white p-4">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{t('commerce.order_number',{number:order.number})}</h3><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{t('dashboard.orders.status_'+order.status)}</span></div>
  <p className="mt-2 text-xs text-slate-500">{t('commerce.demo_time',{time:new Intl.DateTimeFormat(language,{hour:'2-digit',minute:'2-digit'}).format(order.createdAt)})}</p>
  <ul className="my-4 space-y-3">{order.lines.map(line=>{const product=catalog.products.find(p=>p.id===line.productId)!;return <li key={line.key} className="flex items-start gap-3"><img src={product.image} alt="" width="48" height="48" className="h-12 w-12 shrink-0 rounded-lg object-cover"/><div className="min-w-0"><p className="text-sm font-medium">{line.quantity} × {t(product.nameKey)}</p><CommerceLineDetails product={product} line={line}/></div></li>;})}</ul>
  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><span className="text-xs text-slate-500">{t('commerce.pickup_summary',{time:t('commerce.pickup_'+order.pickup)})}</span><span className="font-semibold text-slate-900">{price}</span></div>
  {order.paidVia&&<p className="mt-2 text-xs text-primary">{t('commerce.cash_done')} · {t('commerce.'+order.paidVia+'_method')}</p>}
  {children}
 </article>;
}
