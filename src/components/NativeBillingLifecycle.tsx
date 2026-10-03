import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { isNative } from '@/lib/native';
import { supabase } from '@/integrations/supabase/client';
import { nativeBilling } from '@/services/native-billing';

export function NativeBillingLifecycle() {
  useEffect(() => {
    if (!isNative()) return;
    let disposed = false;
    let authRevision = 0;
    let removeResume: (() => Promise<void>) | undefined;
    const refresh = async () => {
      const revision = authRevision;
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!disposed && !error && revision === authRevision) void nativeBilling.sync(session?.user.id ?? null);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authRevision++;
      // Do not await async SDK work inside the Supabase auth callback.
      void nativeBilling.sync(session?.user.id ?? null);
    });
    void refresh();
    void App.addListener('appStateChange', ({ isActive }) => { if (isActive) void refresh(); })
      .then(handle => { if (disposed) void handle.remove(); else removeResume = () => handle.remove(); });
    window.addEventListener('online', refresh);
    return () => {
      disposed = true;
      subscription.unsubscribe();
      window.removeEventListener('online', refresh);
      void removeResume?.();
    };
  }, []);
  return null;
}
