import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';
import { OrderHistorySheet } from '@/components/dashboard/OrderHistorySheet';
import '@/index.css';

export function HistoryFixture() {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  return <main className="p-4"><nav data-dashboard-nav><button type="button" aria-label={t('dashboard.history.title')} className="min-h-11 rounded-lg border px-4" onClick={() => setOpen(true)}>{t('dashboard.history.title')}</button></nav><OrderHistorySheet restaurantId="history-fixture" open={open} onClose={() => setOpen(false)} /></main>;
}

createRoot(document.getElementById('root')!).render(<LanguageProvider><HistoryFixture /></LanguageProvider>);
