import { useSyncExternalStore } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { isNative } from '@/lib/native';
import { useLanguage } from '@/context/LanguageContext';
import { nativePush, nativePushStatus, subscribeNativePush } from '@/services/native-push-client';
import { Button } from '@/components/ui/button';

export function NativeOrderNotifications() {
  const status = useSyncExternalStore(subscribeNativePush, nativePushStatus);
  const { t } = useLanguage();
  if (!isNative() || status === 'idle' || status === 'enabled') return null;
  return <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4" aria-label={t('native.push.title')}>
    <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
    <div className="flex-1"><p className="text-sm font-semibold">{t('native.push.title')}</p><p className="text-xs text-muted-foreground">{t(status === 'denied' ? 'native.push.denied' : status === 'error' ? 'native.push.error' : 'native.push.description')}</p></div>
    {status !== 'denied' && <Button size="sm" disabled={status === 'enabling'} onClick={() => { void nativePush.enable(); }}>{status === 'enabling' ? <Loader2 className="h-4 w-4 animate-spin" aria-label={t('common.loading')} /> : t(status === 'error' ? 'common.retry' : 'native.push.enable')}</Button>}
  </section>;
}
