import { useLanguage } from '@/context/LanguageContext';
import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { menuMediaCandidates } from '@/lib/menu-media';

type Props = { item: { name: string; image?: string | null; category?: string }; className?: string; };
export function MenuItemImage({item,className = ''}: Props) {
  const { t } = useLanguage();
  const [failed,setFailed] = useState<string[]>([]);
  const candidates=menuMediaCandidates(item);
  const media=candidates.find(candidate=>!failed.includes(candidate.src));
  return <div className={`relative overflow-hidden bg-[#f7f4ee] ${className}`} data-menu-media={media?.kind ?? 'placeholder'}>
    {media ? <img src={media.src} alt={media.kind==='illustration'?`${item.name} (${t('menu.illustration')})`:media.label} loading="lazy" decoding="async" className={`h-full w-full ${media.kind === 'brand' ? 'object-contain p-3' : 'object-cover'}`} onError={()=>setFailed(previous=>[...previous,media.src])} /> : <div className="h-full w-full flex items-center justify-center text-emerald-700/45" role="img" aria-label={item.name}><UtensilsCrossed className="h-8 w-8" aria-hidden="true" /></div>}
    {media?.kind === 'illustration' && <span className="absolute bottom-0 inset-x-0 text-center text-[9px] leading-4 bg-black/45 text-white">{t('menu.illustration')}</span>}
  </div>;
}
