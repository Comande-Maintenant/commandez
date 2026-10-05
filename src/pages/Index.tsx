import { useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, Store, ArrowRight } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { LanguageSelector } from '@/components/restaurant/LanguageSelector';
import { useLanguage } from '@/context/LanguageContext';
import { readEntryPreference, rememberEntryRole, type EntryRole } from '@/lib/entry-preferences';
import '@/components/entry/entry.css';
import { useNativeLaunchReady } from '@/context/NativeLaunchContext';

export default function Index() {
  const navigate = useNavigate();
  const launchReady = useNativeLaunchReady();
  const { t } = useLanguage();
  const location = useLocation();
  const preference = location.state?.chooseRole ? { role: null } : readEntryPreference();
  useEffect(() => { document.title = t('home.page_title'); }, [t]);
  if (preference.role && launchReady) return <Navigate to={preference.role === 'client' ? '/espace/client' : '/espace/commercant'} replace />;
  const choose = (role: EntryRole) => {
    rememberEntryRole(role);
    navigate(role === 'client' ? '/espace/client' : '/espace/commercant');
  };
  return <div className="entry-page">
    <header className="entry-header"><BrandLogo /><LanguageSelector /></header>
    <main className="entry-welcome">
      <div className="entry-photo-fan" aria-hidden="true">
        <img src="/images/menu/kebab.webp" alt="" width="180" height="130" />
        <img src="/images/commerce/grocery-basket.webp" alt="" width="180" height="130" />
        <img src="/images/commerce/seasonal-bouquet.webp" alt="" width="180" height="130" />
      </div>
      <div className="entry-intro"><h1>{t('entry.home_title')}</h1><p>{t('entry.home_description')}</p></div>
      <div className="entry-choices">
        <button type="button" data-primary-action="client" className="entry-choice entry-choice-client" aria-labelledby="entry-client-title" aria-describedby="entry-client-hint" onClick={() => choose('client')}>
          <ShoppingBag aria-hidden="true" /><span><strong id="entry-client-title">{t('entry.client_action')}</strong><small id="entry-client-hint">{t('entry.client_hint')}</small></span><ArrowRight aria-hidden="true" className="rtl:rotate-180" />
        </button>
        <button type="button" className="entry-choice entry-choice-merchant" aria-labelledby="entry-merchant-title" aria-describedby="entry-merchant-hint" onClick={() => choose('merchant')}>
          <Store aria-hidden="true" /><span><strong id="entry-merchant-title">{t('entry.merchant_action')}</strong><small id="entry-merchant-hint">{t('entry.merchant_hint')}</small></span><ArrowRight aria-hidden="true" className="rtl:rotate-180" />
        </button>
      </div>
    </main>
  </div>;
}
