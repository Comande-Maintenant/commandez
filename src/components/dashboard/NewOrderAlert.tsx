import { useRef } from 'react';
import { Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { formatDisplayNumber } from '@/lib/orderNumber';
import type { DbOrder } from '@/types/database';
export function NewOrderAlert({order,onClose,onOpenOrder}: {order:DbOrder|null;onClose:()=>void;onOpenOrder:(order:DbOrder)=>void}) {
  const {t}=useLanguage();
  const previousFocus=useRef<HTMLElement|null>(null);
  const openingOrder=useRef(false);
  return <Dialog open={!!order} onOpenChange={open=>{if(!open)onClose();}}>
    {order&&<DialogContent onOpenAutoFocus={() => { previousFocus.current=document.activeElement instanceof HTMLElement ? document.activeElement : null; openingOrder.current=false; }} onCloseAutoFocus={event => { event.preventDefault(); if (!openingOrder.current && previousFocus.current?.isConnected) previousFocus.current.focus(); }} className="z-[100] w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border-emerald-200 text-center gap-3 [&>button]:min-h-11 [&>button]:min-w-11">
      <div className="mx-auto rounded-2xl bg-emerald-50 p-4 text-emerald-700"><Bell className="h-7 w-7" aria-hidden="true" /></div>
      <DialogTitle className="text-xl font-bold">{t('dashboard.orders.new_order_popup')}</DialogTitle>
      <p className="text-4xl font-extrabold tracking-tight text-emerald-700">{formatDisplayNumber(order)}</p>
      <DialogDescription className="text-sm">{order.customer_name}<br />{order.order_type==='sur_place'?t('dashboard.orders.dine_in'):t('dashboard.orders.takeaway')} · {order.total.toFixed(2)} €</DialogDescription>
      <Button className="min-h-12 rounded-xl mt-2" onClick={()=>{ openingOrder.current=true; onOpenOrder(order); }}>{t('cart.view')}</Button>
    </DialogContent>}
  </Dialog>;
}
