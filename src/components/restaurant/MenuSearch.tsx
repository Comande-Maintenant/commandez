import {Search,X} from 'lucide-react';
import {useLanguage} from '@/context/LanguageContext';
export function MenuSearch({value,onChange,count}:{value:string;onChange:(value:string)=>void;count:number}) {
 const {t}=useLanguage();
 return <div className="mt-5" role="search">
  <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white ps-4 focus-within:ring-2 focus-within:ring-emerald-600/30">
   <Search className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true"/>
   <input type="search" value={value} onChange={event=>onChange(event.target.value)} aria-label={t('journey.search')} placeholder={t('journey.search')} className="min-w-0 flex-1 bg-transparent py-3 text-base text-slate-900 outline-none [&::-webkit-search-cancel-button]:hidden"/>
   {value&&<button type="button" onClick={()=>onChange('')} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-600 focus-visible:outline focus-visible:outline-2" aria-label={t('journey.clear_search')}><X className="h-4 w-4" aria-hidden="true"/></button>}
  </label>
  {value.trim()&&<p role="status" className="mt-2 text-sm text-slate-600">{t('journey.results',{count})}</p>}
 </div>;
}
