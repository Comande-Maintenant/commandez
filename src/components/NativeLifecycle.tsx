import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { isNative, nativeRoute } from '@/lib/native';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';

export function NativeLifecycle() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    if (!isNative()) return;
    let disposed = false;
    const handles: Array<{ remove(): Promise<void> }> = [];
    const keep = async (pending: Promise<{ remove(): Promise<void> }>) => {
      const handle = await pending;
      if (disposed) await handle.remove(); else handles.push(handle);
    };
    const open = async (url: string) => {
      const route = nativeRoute(url);
      if (!route) return;
      const parsed = new URL(url);
      const token = new URLSearchParams(parsed.hash.slice(1));
      const access = token.get('access_token');
      const refresh = token.get('refresh_token');
      if (access && refresh) {
        const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
        if (error) { if (!disposed) navigate('/connexion'); return; }
      } else if (parsed.searchParams.get('code')) {
        const { error } = await supabase.auth.exchangeCodeForSession(parsed.searchParams.get('code')!);
        if (error) { if (!disposed) navigate('/connexion'); return; }
      }
      if (!disposed) navigate(access || parsed.searchParams.has('code') ? parsed.pathname : route, { replace: true });
    };
    void keep(App.addListener('appUrlOpen', event => { void open(event.url); }));
    void App.getLaunchUrl().then(link => { if (link && !disposed) void open(link.url); });
    void keep(App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
    }));
    void Network.getStatus().then(({ connected }) => { if (!disposed) setOffline(!connected); });
    void keep(Network.addListener('networkStatusChange', ({ connected }) => {
      setOffline(!connected);
      if (connected) { supabase.auth.startAutoRefresh(); window.dispatchEvent(new Event('online')); }
    }));
    return () => { disposed = true; for (const handle of handles) void handle.remove(); };
  }, [navigate]);
  return isNative() && offline ? <div role="status" className="fixed bottom-0 inset-x-0 z-[100] bg-amber-100 text-amber-950 p-3 text-center text-sm native-offline">{t('native.offline')}</div> : null;
}
