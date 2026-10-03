import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { nativeSessionStorage } from '@/lib/native';
import { supabase } from '@/integrations/supabase/client';
import { randomUuid } from '@/lib/uuid';
import { createNativePush, type PushStatus, type PushInstallation } from './native-push';

let status: PushStatus = 'idle';
const subscribers = new Set<() => void>();
export const subscribeNativePush = (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; };
export const nativePushStatus = () => status;
const installationIdKey = 'commandeici_push_installation_id';
const installationSecretKey = 'commandeici_push_installation_secret';
async function installation(create: boolean): Promise<PushInstallation | null> {
  const id = await nativeSessionStorage.getItem(installationIdKey);
  const secret = await nativeSessionStorage.getItem(installationSecretKey);
  if (id && secret) return { id, secret };
  if (!create) return null;
  const next = { id: randomUuid(), secret: Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('') };
  await nativeSessionStorage.setItem(installationIdKey, next.id);
  await nativeSessionStorage.setItem(installationSecretKey, next.secret);
  return next;
}
export const nativePush = createNativePush({
  native: Capacitor.getPlatform() === 'ios',
  environment: import.meta.env.VITE_APNS_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production',
  sdk: PushNotifications,
  storage: nativeSessionStorage,
  installation,
  async resetInstallation() {
    await nativeSessionStorage.removeItem(installationSecretKey);
    await nativeSessionStorage.removeItem(installationIdKey);
  },
  async initialize(identity, signal) {
    const { error } = await supabase.rpc('initialize_order_push_installation' as never, { p_installation_id: identity.id, p_installation_secret: identity.secret } as never).abortSignal(signal);
    if (error) throw error;
  },
  async register(token, environment, identity, signal) {
    const { error } = await supabase.rpc('register_order_push_device' as never, { p_token: token, p_environment: environment, p_platform: 'ios', p_installation_id: identity.id, p_installation_secret: identity.secret } as never).abortSignal(signal);
    if (error) throw error;
  },
  async revoke(identity, signal) {
    const { error } = await supabase.rpc('revoke_order_push_installation' as never, { p_installation_id: identity.id, p_installation_secret: identity.secret } as never).abortSignal(signal);
    if (error) throw error;
  },
  onChange(next) { status = next; for (const listener of subscribers) listener(); },
});
export async function suspendNativePushBeforeSignOut(): Promise<void> {
  if (Capacitor.getPlatform() === 'ios') await nativePush.suspend();
}
