import { useState } from 'react';
import { Bell, Plus, Sparkles, Check } from 'lucide-react';
import {Link} from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { isNative, openNotificationSettings } from '@/lib/native';
import { createDemoOrder } from '@/lib/demo-order';
import { scheduleDemoNotification } from '@/services/demo-notifications';
import { useRestaurantOrderFeed } from '@/context/RestaurantOrdersContext';
import {demoJourney} from '@/lib/demo-journey';

export function DemoOrderControls({restaurantId,onNavigate,compact=false}: {restaurantId:string;compact?:boolean;onNavigate:(view:'cuisine'|'caisse')=>void}) {
  const { t } = useLanguage();
  const feed=useRestaurantOrderFeed();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [denied,setDenied]=useState(false);
  const journey=demoJourney(restaurantId,feed.orders);
  const progress={start:0,received:1,preparing:2,ready:3,done:4}[journey.stage];
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
  if(compact)return <section className="mb-4 rounded-2xl border border-emerald-200 bg-white p-4" aria-label={t('demo.try.title')}>
    <div role="progressbar" aria-label={t('demo.try.title')} aria-valuemin={0} aria-valuemax={4} aria-valuenow={progress} className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{width:`${progress*25}%`}}/></div>
    <p role="status" className="mt-3 text-sm text-slate-700">{t(journey.stage==='done'?'journey.demo_done':'journey.demo_cash_help')}</p>
    {journey.stage==='done'?<Link to="/inscription" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">{t('home.create_free')}</Link>:<Button variant="link" className="mt-1 min-h-11 p-0 text-emerald-800" onClick={()=>onNavigate('cuisine')}>{t('dashboard.onboarding.step_kitchen')}</Button>}
  </section>;
  return <section className="mb-4 rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5" aria-label={t('demo.try.title')}>
    <div className="flex gap-3 items-start"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Sparkles className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><h2 className="font-semibold text-sm">{t('demo.try.title')}</h2><p className="text-xs text-muted-foreground mt-1">{t('demo.try.description')}</p></div></div>
    <div role="progressbar" aria-label={t('demo.try.title')} aria-valuemin={0} aria-valuemax={4} aria-valuenow={progress} className="my-4 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-[width] motion-reduce:transition-none" style={{width:`${progress*25}%`}}/></div>
    <ol className="grid grid-cols-4 gap-2 text-[11px] sm:text-xs">{['new','preparing','ready','done'].map((status,index)=><li key={status} className={`flex items-start gap-1 ${index<progress?'text-emerald-800':'text-slate-500'}`} aria-current={index===progress-1?'step':undefined}>{index<progress&&<Check className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true"/>}<span>{t(`dashboard.orders.status_${status}`)}</span></li>)}</ol>
    {journey.stage!=='start'&&<p role="status" className="mt-3 text-sm leading-relaxed text-slate-700">{t(`journey.demo_${journey.stage}`)}</p>}
    {journey.stage==='ready'&&<Button onClick={()=>onNavigate('caisse')} className="mt-3 min-h-11 rounded-xl bg-primary">{t('journey.demo_cash')}</Button>}
    {journey.stage==='done'&&<Link to="/inscription" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">{t('home.create_free')}</Link>}
    <div className="mt-3 flex flex-wrap gap-2"><Button disabled={feed.loading} onClick={receive} className="min-h-11 rounded-xl gap-2"><Plus className="h-4 w-4" aria-hidden="true" />{t('demo.try.receive')}</Button>{isNative()&&<Button variant="outline" disabled={busy||feed.loading} onClick={()=>void testNotification()} className="min-h-11 rounded-xl gap-2"><Bell className="h-4 w-4" aria-hidden="true" />{busy?t('common.loading'):t('demo.try.ios')}</Button>}</div>
    <Link to="/demo" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-emerald-800 underline underline-offset-4">{t('journey.demo_menu')}</Link>
    {isNative()&&<p className="mt-1 text-xs leading-relaxed text-slate-500">{t('journey.demo_native_hint')}</p>}
    {denied&&<Button variant="link" onClick={()=>void openNotificationSettings().catch(()=>setMessage(t('native.push.denied')))}>{t('native.push.settings')}</Button>}
    {message&&<p role="status" className="mt-3 text-xs leading-relaxed text-emerald-800">{message}</p>}
  </section>;
}
