import {useLanguage} from '@/context/LanguageContext';
import {type CommerceDemoLine,type DemoProduct} from '@/lib/demo-commerce';
export function CommerceLineDetails({line,product}: {line:CommerceDemoLine;product:DemoProduct}) {
 const {t}=useLanguage();
 return <><p className="text-xs leading-relaxed text-slate-500">{product.options.map(group=>t(group.choices.find(choice=>choice.id===line.choices[group.id])!.labelKey)).join(' · ')}</p>{line.note&&<p className="mt-1 break-words text-xs text-slate-600">{t('commerce.gift_note')}: {line.note}</p>}</>;
}
