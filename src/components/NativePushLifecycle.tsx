import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { isNative } from '@/lib/native';
import { supabase } from '@/integrations/supabase/client';
import { nativePush } from '@/services/native-push-client';
import { notificationRoute } from '@/services/native-push';

export function NativePushLifecycle() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNative()) return;
    let disposed = false;
    let revision = 0;
    const handles: Array<{ remove(): Promise<void> }> = [];
    const keep = async (pending: Promise<{ remove(): Promise<void> }>) => {
      const handle = await pending;
      if (disposed) await handle.remove(); else handles.push(handle);
    };
    const ownedRestaurants = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;
      const { data, error: queryError } = await supabase.from('restaurants').select('slug').eq('owner_id', user.id);
      if (queryError) throw queryError;
      return { userId: user.id, slugs: (data ?? []).map(row => row.slug) };
    };
    const refresh = async () => {
      const current = ++revision;
      try {
        const owned = await ownedRestaurants();
        if (!disposed && current === revision) await nativePush.sync(owned?.slugs.length ? owned.userId : null);
      } catch { /* Offline owner lookup must not prompt or attach another user. */ }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      revision++;
      if (!session) void nativePush.sync(null);
      // Supabase auth callbacks must return before using authenticated queries.
      else queueMicrotask(() => { if (!disposed) void refresh(); });
    });
    void refresh();
    void keep(App.addListener('appStateChange', ({ isActive }) => { if (isActive) void refresh(); }));
    void keep(PushNotifications.addListener('pushNotificationActionPerformed', async ({ notification }) => {
      try {
        const owned = await ownedRestaurants();
        const route = notificationRoute(notification.data ?? {}, owned?.slugs ?? []);
        if (route && !disposed) { navigate(route); window.dispatchEvent(new Event('commandeici:refresh-orders')); }
      } catch { /* A notification never bypasses merchant authorization. */ }
    }));
    window.addEventListener('online', refresh);
    return () => {
      disposed = true; revision++; subscription.unsubscribe();
      window.removeEventListener('online', refresh);
      for (const handle of handles) void handle.remove();
      void nativePush.dispose();
    };
  }, [navigate]);
  return null;
}
