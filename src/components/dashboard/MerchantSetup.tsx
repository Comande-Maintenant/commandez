import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Check,ChevronDown,BookOpen} from 'lucide-react';
import {useLanguage} from '@/context/LanguageContext';
import {fetchMenuItems} from '@/lib/api';
import type {DbRestaurant} from '@/types/database';
import {Button} from '@/components/ui/button';

type Preferences={preview:boolean;shared:boolean;hidden:boolean};
const empty:Preferences={preview:false,shared:false,hidden:false};
function readPreferences(key:string):Preferences {
 try {const saved=JSON.parse(localStorage.getItem(key)??'null');return {preview:saved?.preview===true,shared:saved?.shared===true,hidden:saved?.hidden===true};}catch{return {...empty};}
}
export function MerchantSetup({restaurant,ownerUserId,onNavigate}:{restaurant:DbRestaurant;ownerUserId:string|null;onNavigate:(view:'carte'|'qrcodes')=>void}) {
 const {t}=useLanguage();
 const authorized=!!ownerUserId&&ownerUserId===restaurant.owner_id;
 const key=`cm_setup_v1_${ownerUserId}_${restaurant.id}`;
 const [preferences,setPreferences]=useState(()=>readPreferences(key));
 const [menu,setMenu]=useState<'loading'|'empty'|'ready'|'error'>('loading');
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!authorized)return;
  let cancelled=false;setMenu('loading');
  void fetchMenuItems(restaurant.id).then(items=>{if(!cancelled)setMenu(items.some(item=>item.enabled&&item.product_type!=='supplement')?'ready':'empty');}).catch(()=>{if(!cancelled)setMenu('error');});
  const refresh=()=>setAttempt(value=>value+1);window.addEventListener('commandeici:resume',refresh);
  return()=>{cancelled=true;window.removeEventListener('commandeici:resume',refresh);};
 },[authorized,restaurant.id,attempt]);
 const update=(patch:Partial<Preferences>)=>setPreferences(current=>{
  const next={...current,...patch};try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Guidance still works with unavailable storage. */}return next;
 });
 if(!authorized)return null;
 if(preferences.hidden)return <Button variant="ghost" className="mb-3 min-h-11 gap-2" onClick={()=>update({hidden:false})}><BookOpen className="h-4 w-4" aria-hidden="true"/>{t('journey.setup_show')}</Button>;
 const menuReady=menu==='ready';
 const progress=menuReady?1+Number(preferences.preview)+Number(preferences.shared):0;
 return <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label={t('journey.setup_title')}>
  <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-base text-slate-900">{t('journey.setup_title')}</h2><p className="mt-1 text-sm text-slate-600">{t('journey.setup_description')}</p></div><button className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-slate-500" onClick={()=>update({hidden:true})} aria-label={t('journey.setup_hide')}><ChevronDown className="h-5 w-5" aria-hidden="true"/></button></div>
  <div role="progressbar" aria-label={t('journey.setup_title')} aria-valuemin={0} aria-valuemax={3} aria-valuenow={progress} className="my-4 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{width:`${progress/3*100}%`}}/></div>
  {menu==='error'&&<div role="status" className="mb-3 text-sm text-slate-600"><p>{t('journey.setup_retry')}</p><Button variant="outline" onClick={()=>setAttempt(value=>value+1)} className="mt-2 min-h-11">{t('common.retry')}</Button></div>}
  <ol className="space-y-4">
   <li className="flex gap-3"><span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${menuReady?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-600'}`}>{menuReady?<Check className="h-4 w-4" aria-label={t('common.finish')}/>:1}</span><div className="min-w-0"><Button variant="link" className="min-h-11 h-auto p-0 text-start text-emerald-800 whitespace-normal" onClick={()=>onNavigate('carte')}>{t('journey.setup_menu')}</Button>{menu==='loading'&&<p className="text-xs text-slate-500">{t('common.loading')}</p>}</div></li>
   <li className="flex gap-3"><span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">2</span><div className="min-w-0"><Link to={`/${restaurant.slug}`} className="flex min-h-11 items-center text-sm font-medium text-emerald-800 underline underline-offset-4">{t('journey.setup_preview')}</Link><label className="flex min-h-11 items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={menuReady&&preferences.preview} disabled={!menuReady} onChange={event=>update({preview:event.target.checked})} className="h-5 w-5 accent-emerald-700"/>{t('journey.setup_verified')}</label></div></li>
   <li className="flex gap-3"><span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">3</span><div className="min-w-0"><Button variant="link" className="min-h-11 h-auto p-0 text-start text-emerald-800 whitespace-normal" onClick={()=>onNavigate('qrcodes')}>{t('journey.setup_share')}</Button><label className="flex min-h-11 items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={menuReady&&preferences.shared} disabled={!menuReady} onChange={event=>update({shared:event.target.checked})} className="h-5 w-5 accent-emerald-700"/>{t('journey.setup_shared')}</label></div></li>
  </ol>
 </section>;
}
