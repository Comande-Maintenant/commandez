import { useState } from 'react';
import { Bell, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { isNative, openNotificationSettings } from '@/lib/native';
import { createDemoOrder } from '@/lib/demo-order';
import { scheduleDemoNotification } from '@/services/demo-notifications';
import { useRestaurantOrderFeed } from '@/context/RestaurantOrdersContext';

export function DemoOrderControls({restaurantId}: {restaurantId:string}) {
  const { t } = useLanguage();
  const feed=useRestaurantOrderFeed();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [denied,setDenied]=useState(false);
  const receive=()=>{
    const number=1+Math.max(0,...feed.orders.map(order=>order.daily_number??order.order_number));
    feed.receiveDemoOrder(createDemoOrder(restaurantId,number,{customer:t('demo.try.customer'),notes:t('demo.try.notes')}));
  };
  const testNotification=async()=>{
    if(busy)return;
    setBusy(true);setDenied(false);
    try {
      const result=await scheduleDemoNotification({title:t('demo.try.notification_title'),body:t('demo.try.notification_body')});
      if(result==='scheduled') {
        receive();
        setMessage(t('demo.try.instructions'));
        toast.success(t('demo.try.scheduled'));
      } else if(result==='denied') {setDenied(true);setMessage(t('native.push.denied'));}
    } catch {setMessage(t('native.push.error'));}
    finally {setBusy(false);}
  };
  return <section className="mb-4 rounded-2xl border border-emerald-200 bg-white p-4" aria-label={t('demo.try.title')}>
    <div className="flex gap-3 items-start"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Sparkles className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><h2 className="font-semibold text-sm">{t('demo.try.title')}</h2><p className="text-xs text-muted-foreground mt-1">{t('demo.try.description')}</p></div></div>
    <div className="mt-3 flex flex-wrap gap-2"><Button disabled={feed.loading} onClick={receive} className="min-h-11 rounded-xl gap-2"><Plus className="h-4 w-4" aria-hidden="true" />{t('demo.try.receive')}</Button>{isNative()&&<Button variant="outline" disabled={busy||feed.loading} onClick={()=>void testNotification()} className="min-h-11 rounded-xl gap-2"><Bell className="h-4 w-4" aria-hidden="true" />{busy?t('common.loading'):t('demo.try.ios')}</Button>}</div>
    {denied&&<Button variant="link" onClick={()=>void openNotificationSettings().catch(()=>setMessage(t('native.push.denied')))}>{t('native.push.settings')}</Button>}
    {message&&<p role="status" className="mt-3 text-xs leading-relaxed text-emerald-800">{message}</p>}
  </section>;
}
