import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Store } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { rememberEntryRole, type EntryRole } from '@/lib/entry-preferences';
export function EntryRoleSwitch({ to, compact = false }: { to: EntryRole; compact?: boolean }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const label = t(to === 'client' ? 'entry.switch_client' : 'entry.switch_merchant');
  const Icon = to === 'client' ? ShoppingBag : Store;
  return <button type="button" aria-label={label} title={label} className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-[#002D19] hover:bg-[#F1F7F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#177E32]" onClick={() => { rememberEntryRole(to); navigate(to === 'client' ? '/espace/client' : '/espace/commercant'); }}><Icon className="h-5 w-5 shrink-0" aria-hidden="true" />{!compact && <span>{label}</span>}</button>;
}
