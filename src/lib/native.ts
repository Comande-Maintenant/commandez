import { Capacitor, registerPlugin } from '@capacitor/core';
import { Share } from '@capacitor/share';

export const isNative = () => Capacitor.isNativePlatform();
export const publicAppUrl = 'https://app.commandeici.com';
export const authRedirectUrl = (path: string) => isNative() ? `commandeici://auth${path}` : `${window.location.origin}${path}`;

export function nativeRoute(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol === 'commandeici:' && url.hostname === 'auth') {
      if (!['/inscription', '/profil', '/reinitialiser-mot-de-passe'].includes(url.pathname)) return null;
    } else if (url.protocol !== 'https:' || url.hostname !== 'app.commandeici.com') return null;
    if (!url.pathname.startsWith('/') || url.pathname.startsWith('//')) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}

interface SecureSessionPlugin {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}
const secureSession = registerPlugin<SecureSessionPlugin>('SecureSession');
export const nativeSessionStorage = {
  getItem: async (key: string) => (await secureSession.get({ key })).value,
  setItem: async (key: string, value: string) => { await secureSession.set({ key, value }); },
  removeItem: async (key: string) => { await secureSession.remove({ key }); },
};

export async function shareRestaurant(slug: string, title: string) {
  const url = `${publicAppUrl}/${encodeURIComponent(slug)}`;
  if (isNative()) await Share.share({ title, url });
  else if (navigator.share) await navigator.share({ title, url });
  else await navigator.clipboard.writeText(url);
}
