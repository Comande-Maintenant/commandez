import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isEmbeddedDemoPath } from '@/lib/embedded-demo';
import { useCart } from '@/context/CartContext';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { isNative, nativeRoute } from '@/lib/native';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';

import { NativeLaunchContext } from '@/context/NativeLaunchContext';

export function NativeLifecycle({ children }: { children?: ReactNode }) {
  const [launchReady, setLaunchReady] = useState(!isNative());
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { restaurantId } = useCart();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  const { t } = useLanguage();
  const [offline, setOffline] = useState(!navigator.onLine);
  const handledCodesRef = useRef(new Set<string>());
  useEffect(() => {
    if (!isNative()) return;
    let disposed = false;
    const handledCodes = handledCodesRef.current;
    const handles: Array<{ remove(): Promise<void> }> = [];
    const keep = async (pending: Promise<{ remove(): Promise<void> }>) => {
      const handle = await pending;
      if (disposed) await handle.remove(); else handles.push(handle);
    };
    const open = async (url: string) => {
      const route = nativeRoute(url);
      if (!route) return;
      const parsed = new URL(url);
      const code = parsed.searchParams.get('code');
      if (code) {
        if (handledCodes.has(code)) return;
        handledCodes.add(code);
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) { if (!disposed) navigateRef.current('/connexion'); return; }
        } catch {
          if (!disposed) navigateRef.current('/connexion');
          return;
        }
      }
      if (!disposed) navigateRef.current(code ? parsed.pathname : route, { replace: true });
    };
    void keep(App.addListener('appUrlOpen', event => { void open(event.url); }));
    void App.getLaunchUrl().then(async link => { if (link && !disposed) await open(link.url); }).catch(() => { /* Entry stays usable if the launch plugin is unavailable. */ }).finally(() => { if (!disposed) setLaunchReady(true); });
    void keep(App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        supabase.auth.startAutoRefresh();
        window.dispatchEvent(new Event('commandeici:resume'));
      } else supabase.auth.stopAutoRefresh();
    }));
    void Network.getStatus().then(({ connected }) => { if (!disposed) setOffline(!connected); });
    void keep(Network.addListener('networkStatusChange', ({ connected }) => {
      setOffline(!connected);
      if (connected) { supabase.auth.startAutoRefresh(); window.dispatchEvent(new Event('online')); }
    }));
    return () => { disposed = true; for (const handle of handles) void handle.remove(); };
  }, []);
  return <NativeLaunchContext.Provider value={launchReady}>{children}{isNative() && offline && !isEmbeddedDemoPath(pathname, restaurantId) ? <div role="status" className="fixed bottom-0 inset-x-0 z-[100] bg-amber-100 text-amber-950 p-3 text-center text-sm native-offline">{t('native.offline')}</div> : null}</NativeLaunchContext.Provider>;
}
