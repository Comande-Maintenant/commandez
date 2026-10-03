import { useEffect, useState, useSyncExternalStore } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { isNative, openNotificationSettings } from '@/lib/native';
import { useLanguage } from '@/context/LanguageContext';
import { nativePush, nativePushStatus, subscribeNativePush } from '@/services/native-push-client';
import { Button } from '@/components/ui/button';

export function NativeOrderNotifications({ ownerUserId }: { ownerUserId?: string | null }) {
  const [requestError, setRequestError] = useState(false);
  const [checking, setChecking] = useState(false);
  const verifyOwner = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    return !error && !!ownerUserId && session?.user.id === ownerUserId;
  };
  useEffect(() => {
    if (!isNative() || !ownerUserId) return;
    let disposed = false;
    const refresh=() => { void verifyOwner().then(valid => { if (valid && !disposed) return nativePush.sync(ownerUserId); }).catch(() => { if (!disposed) setRequestError(true); }); };
    refresh();
    window.addEventListener('commandeici:resume',refresh);
    return () => { disposed = true; window.removeEventListener('commandeici:resume',refresh); };
  }, [ownerUserId]);
  const enable = async () => {
    setChecking(true); setRequestError(false);
    try {
      if (!await verifyOwner()) { setRequestError(true); return; }
      await nativePush.sync(ownerUserId!);
      if (nativePush.status() === 'prompt') await nativePush.enable();
    } catch { setRequestError(true); }
    finally { setChecking(false); }
  };
  const sdkStatus = useSyncExternalStore(subscribeNativePush, nativePushStatus);
  const status = requestError ? 'error' : sdkStatus;
  const { t } = useLanguage();
  if (!isNative() || status === 'idle') return null;
  return <section className="flex flex-wrap items-center gap-3 mb-4 rounded-2xl border border-border bg-card p-4" aria-label={t('native.push.title')}>
    <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
    <div className="flex-1 min-w-0 basis-40"><p className="text-sm font-semibold">{t('native.push.title')}</p><p className="text-xs text-muted-foreground">{t(status === 'denied' ? 'native.push.denied' : status === 'error' ? 'native.push.error' : status === 'enabled' ? 'native.push.enabled' : 'native.push.description')}</p></div>
    {status === 'denied' && <Button variant="outline" size="sm" onClick={() => { void openNotificationSettings().catch(() => setRequestError(true)); }}>{t('native.push.settings')}</Button>}
    {status !== 'denied' && status !== 'enabled' && <Button size="sm" disabled={checking || status === 'enabling'} onClick={() => { void enable(); }}>{checking || status === 'enabling' ? <Loader2 className="h-4 w-4 animate-spin" aria-label={t('common.loading')} /> : t(status === 'error' ? 'common.retry' : 'native.push.enable')}</Button>}
  </section>;
}
