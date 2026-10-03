import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { nativeSessionStorage } from '@/lib/native';
import { supabase } from '@/integrations/supabase/client';
import { createNativePush, type PushStatus } from './native-push';

let status: PushStatus = 'idle';
const subscribers = new Set<() => void>();
export const subscribeNativePush = (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; };
export const nativePushStatus = () => status;
export const nativePush = createNativePush({
  native: Capacitor.getPlatform() === 'ios',
  environment: import.meta.env.VITE_APNS_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production',
  sdk: PushNotifications,
  storage: nativeSessionStorage,
  async register(token, environment) {
    const { error } = await supabase.rpc('register_order_push_device' as never, { p_token: token, p_environment: environment, p_platform: 'ios' } as never);
    if (error) throw error;
  },
  async revoke(token) {
    const { error } = await supabase.rpc('unregister_order_push_device' as never, { p_token: token } as never);
    if (error) throw error;
  },
  onChange(next) { status = next; for (const listener of subscribers) listener(); },
});
export async function suspendNativePushBeforeSignOut(): Promise<void> {
  if (Capacitor.getPlatform() === 'ios') await nativePush.suspend();
}
