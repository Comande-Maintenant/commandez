import {ArrowLeft} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {useLanguage} from '@/context/LanguageContext';
import {navigateBack} from '@/lib/navigation';

export function PageExit({fallback='/'}:{fallback?:string}) {
 const navigate=useNavigate();const {t}=useLanguage();
 return <button type="button" onClick={()=>navigateBack(navigate,fallback)} className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft className="h-5 w-5 shrink-0 rtl:rotate-180" aria-hidden="true"/>{t('nav.back')}</button>;
}
