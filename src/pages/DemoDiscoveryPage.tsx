import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {BrandLogo} from '@/components/BrandLogo';
import {useLanguage} from '@/context/LanguageContext';
import {LanguageSelector} from '@/components/restaurant/LanguageSelector';
const choices=[{key:'restaurant',path:'/admin/demo',image:'/images/menu/kebab.webp'},{key:'grocery',path:'/demo/epicerie',image:'/images/commerce/grocery-basket.webp'},{key:'florist',path:'/demo/fleuriste',image:'/images/commerce/seasonal-bouquet.webp'}];
export default function DemoDiscoveryPage(){
 const {t}=useLanguage();
 return <div className="min-h-screen bg-white"><header className="border-b border-slate-100"><div className="mx-auto max-w-5xl px-4 min-h-16 flex items-center justify-between gap-3"><Link to="/" aria-label="commandeici"><BrandLogo/></Link><LanguageSelector/></div></header>
 <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10"><Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600"><ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true"/>{t('commerce.back')}</Link>
 <h1 className="mt-3 max-w-xl text-3xl sm:text-4xl font-bold tracking-tight text-[#002D19]">{t('commerce.discovery_title')}</h1><p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">{t('commerce.discovery_description')}</p>
 <div className="mt-7 grid gap-4 md:grid-cols-3">{choices.map(choice=><Link key={choice.key} to={choice.path} className="group min-w-0 flex items-center gap-4 rounded-2xl border border-slate-200 p-3 sm:p-4 md:flex-col md:items-stretch hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><img src={choice.image} alt="" width="160" height="160" className="h-24 w-24 shrink-0 rounded-xl object-cover md:h-44 md:w-full"/><div className="min-w-0 flex-1"><h2 className="break-words text-lg font-semibold text-slate-900">{t('commerce.'+choice.key)}</h2><p className="mt-1 text-sm leading-relaxed text-slate-600">{t('commerce.'+choice.key+'_description')}</p><span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"><span className="min-w-0 break-words">{t('demo.cta_try')}</span><ArrowRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true"/></span></div></Link>)}</div>
 <p className="mt-5 text-xs leading-relaxed text-slate-500">{t('commerce.demo_note')}</p><Link to="/inscription" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white">{t('home.create_free')}</Link>
 </main></div>;
}
